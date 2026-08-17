import path from 'node:path';
import { fileURLToPath } from 'node:url';
import peggy from 'peggy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 预编译 Peggy Parser 以适配 Workers 运行环境（避免动态 eval / Function）
 */
function precompilePeggyParser(code, id) {
  // 匹配常见的 grammar 变量定义或直接调用 peggy.generate 的模板内容
  const grammarMatch =
    code.match(/(?:const|let|var)\s+(?:grammar|grammars|peggyGrammar|pegGrammar)\s*=\s*[`'"]([\s\S]*?)[`'"];?/) ||
    code.match(/peggy\.generate\(\s*[`'"]([\s\S]*?)[`'"]/);

  if (!grammarMatch || !grammarMatch[1]) {
    // 若上游已直接提供预编译产物或变量名变更，则告警跳过，不阻断构建
    console.warn(`[sub-store-transform] ${id}: 跳过 Peggy 语法预编译（未找到 grammars 变量，保留原文件）`);
    return code;
  }

  const grammar = grammarMatch[1];

  try {
    const parserSource = peggy.generate(grammar, {
      output: 'source',
      format: 'es',
    });

    return `
      ${parserSource}
      export default { parse };
    `;
  } catch (err) {
    console.error(`[sub-store-transform] ${id} Peggy 预编译异常: ${err.message}`);
    return code;
  }
}

/**
 * Sub-Store Workers 共享转换插件
 */
function subStoreTransformPlugin() {
  return {
    name: 'sub-store-transform',
    enforce: 'pre',
    transform(code, id) {
      // 处理 peggy parser 目录下的语法文件
      if (id.includes('parsers/peggy/') && id.endsWith('.js')) {
        return {
          code: precompilePeggyParser(code, id),
          map: null,
        };
      }
      return null;
    },
  };
}

/**
 * 导出公共构建配置组件
 */
export function createDashboardBuildParts() {
  return {
    plugins: [
      subStoreTransformPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    assetsDir: 'assets',
    input: {
      index: path.resolve(__dirname, 'src/index.html'),
    },
    external: [],
    optimizeDeps: {
      include: ['peggy'],
    },
  };
}
