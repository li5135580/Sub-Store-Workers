import path from 'node:path';
import { fileURLToPath } from 'node:url';
import peggy from 'peggy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 预编译 Peggy Parser 以适配 Workers 运行环境（避免动态 eval / Function）
 */
function precompilePeggyParser(code, id) {
  // 匹配单数 grammar、复数 grammars 或模板字符串调用
  const match =
    code.match(/(?:const|let|var)\s+(?:grammars?|peggyGrammar|pegGrammar)\s*=\s*[`'"]([\s\S]*?)[`'"];?/) ||
    code.match(/peggy\.generate\(\s*[`'"]([\s\S]*?)[`'"]/);

  if (!match || !match[1]) {
    // 遇到未匹配到的情况不阻断构建，告警并保留原代码
    console.warn(`[sub-store-transform] ${id}: 跳过 Peggy 预编译（未找到 grammars 变量）`);
    return code;
  }

  const grammar = match[1];

  try {
    const parserSource = peggy.generate(grammar, {
      output: 'source',
      format: 'es',
    });

    return `${parserSource}\nexport default { parse };`;
  } catch (err) {
    console.warn(`[sub-store-transform] ${id} Peggy 预编译失败，跳过: ${err.message}`);
    return code;
  }
}

/**
 * Sub-Store 源码转换插件
 */
function subStoreTransformPlugin() {
  return {
    name: 'sub-store-transform',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('parsers/peggy/') && (id.endsWith('.js') || id.endsWith('.mjs'))) {
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
 * 导出构建基础配置
 */
export function createDashboardBuildParts() {
  return {
    plugins: [
      subStoreTransformPlugin(),
    ],
    resolve: {
      alias: [
        {
          find: /^@\/(.*)/,
          replacement: path.resolve(__dirname, 'src/$1'),
        },
        {
          find: /^sub-store\/(.*)/,
          replacement: path.resolve(__dirname, 'sub-store/$1'),
        },
      ],
    },
    assetsDir: 'assets',
    input: {
      index: path.resolve(__dirname, 'index.html'),
    },
    external: [],
    optimizeDeps: {
      include: ['peggy'],
    },
  };
}

export default {
  createDashboardBuildParts,
};
