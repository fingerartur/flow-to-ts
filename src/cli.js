const { Command } = require("commander");
const fs = require("fs");
const glob = require("glob");
const prettier = require("prettier");

const convert = require("./convert.js");
const detectJsx = require("./detect-jsx.js");
const version = require("../package.json").version;

const cli = (argv) => {
  const program = new Command();
  program
    .version(version)
    .option(
      "--inline-utility-types",
      "inline utility types when possible, defaults to 'false'"
    )
    .option("--prettier", "use prettier for formatting")
    .option(
      "--semi",
      "add semi-colons, defaults to 'false' (depends on --prettier)"
    )
    .option(
      "--single-quote",
      "use single quotes instead of double quotes, defaults to 'false' (depends on --prettier)"
    )
    .option(
      "--tab-width [width]",
      "size of tabs (depends on --prettier)",
      /2|4/,
      4
    )
    .option(
      "--trailing-comma [all|es5|none]",
      "where to put trailing commas (depends on --prettier)",
      /all|es5|none/,
      "all"
    )
    .option(
      "--bracket-spacing",
      "put spaces between braces and contents, defaults to 'false' (depends on --prettier)"
    )
    .option(
      "--arrow-parens [avoid|always]",
      "arrow function param list parens (depends on --prettier)",
      /avoid|always/,
      "avoid"
    )
    .option("--print-width [width]", "line width (depends on --prettier)", 80)
    .option("--write", "write output to disk instead of STDOUT")
    .option("--delete-source", "delete the source file");

  program.parse(argv);

  if (program.args.length === 0) {
    program.outputHelp();
    process.exit(1);
  }

  const options = {
    inlineUtilityTypes: Boolean(program.inlineUtilityTypes),
    prettier: program.prettier,
    prettierOptions: {
      semi: Boolean(program.semi),
      singleQuote: Boolean(program.singleQuote),
      tabWidth: parseInt(program.tabWidth),
      trailingComma: program.trailingComma,
      bracketSpacing: Boolean(program.bracketSpacing),
      arrowParens: program.arrowParens,
      printWidth: parseInt(program.printWidth),
    },
  };

  if (options.prettier) {
    try {
      const prettierConfig = prettier.resolveConfig.sync(process.cwd());
      if (prettierConfig) {
        options.prettierOptions = prettierConfig;
      }
    } catch (e) {
      console.error("error parsing prettier config file");
      console.error(e);
      process.exit(1);
    }
  }

  const files = getJsFiles(program);
  const badFiles = [];

  for (const file of files) {
    try {
      transformFileFromFlowToTs(file, options, program);
    } catch (e) {
      console.error(`error processing ${file}:`);
      console.info("-------------------------");
      console.info(e);
      console.info("");

      badFiles.push(file);
    }
  }

  console.info("");
  console.info(`${files.size} files processed`);

  if (badFiles.length > 0) {
    console.info("");
    console.warn(
      `WARNING: ${badFiles.length}/${files.size} files were skipped due to an error`
    );
    for (const file of badFiles) {
      console.warn(file);
    }
  }
};

module.exports = cli;

function getJsFiles(program) {
  const files = new Set();
  for (const arg of program.args) {
    for (const file of glob.sync(arg)) {
      if (isJsFile(file)) {
        files.add(file);
      }
    }
  }
  return files;
}

function isJsFile(file) {
  return file.endsWith(".js") || file.endsWith(".jsx");
}

/**
 * @throws
 */
function transformFileFromFlowToTs(file, options, program) {
  const inFile = file;
  const inCode = fs.readFileSync(inFile, "utf-8");

  const outCode = convert(inCode, options);

  if (program.write) {
    const extension = detectJsx(inCode) ? ".tsx" : ".ts";
    const outFile = file.replace(/\.jsx?$/, extension);
    fs.writeFileSync(outFile, outCode);
  } else {
    console.log(outCode);
  }

  if (program.deleteSource) {
    fs.unlinkSync(inFile);
  }
}
