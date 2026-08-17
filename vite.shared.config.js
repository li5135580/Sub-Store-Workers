import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import peggy from 'peggy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 预编译 Peggy Parser 以适配 Workers / Deno 运行环境
 */
function precompilePeggyParser(code, id) {
  // 兼容单数 grammar、复数 grammars 或模板字符串
  const match =
    code.match(/(?:const|let|var)\s+(?:grammars?|peggyGrammar|pegGrammar)\s*=\s*[`'"]([\s\S]*?)[`'"];?/) ||
    code.match(/peggy\.generate\(\s*[`'"]([\s\S]*?)[`'"]/);

  if (!match || !match[1]) {
    console.warn(`[sub-store-transform] ${id}: 未找到 grammars 变量，跳过预编译`);
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
    console.warn(`[sub-store-transform] ${id} Peggy 预编译失败，保留原代码: ${err.message}`);
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
 * 查找前端 Dashboard 的入口文件
 */
function findDashboardEntry() {
  const possiblePaths = [
    path.resolve(__dirname, 'sub-store/frontend/index.html'),
    path.resolve(__dirname, 'sub-store/packages/frontend/index.html'),
    path.resolve(__dirname, 'frontend/index.html'),
    path.resolve(__dirname, 'src/dashboard/index.html'),
    path.resolve(__dirname, 'src/frontend/index.html'),
    path.resolve(__dirname, 'src/index.html'),
    path.resolve(__dirname, 'index.html'),
  ];

  for (const entry of possiblePaths) {
    if (fs.existsSync(entry)) {
      return entry;
    }
  }

  // 兜底返回 sub-store 前端默认路径
  return path.resolve(__dirname, 'sub-store/frontend/index.html');
}

/**
 * 导出公共构建配置
 */
export function createDashboardBuildParts() {
  const entry = findDashboardEntry();

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
      index: entry,
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
