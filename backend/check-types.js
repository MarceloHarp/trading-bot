// TypeScript type-check via API (workaround for Node v24 + TS 5.9 tsc binary bug)
const ts = require('typescript');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, __dirname);

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length === 0) {
  console.log('✅ TypeScript: sin errores');
  process.exit(0);
} else {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => __dirname,
    getCanonicalFileName: f => f,
    getNewLine: () => '\n',
  });
  console.error(formatted);
  console.error(`❌ ${diagnostics.length} error(s) encontrado(s)`);
  process.exit(1);
}
