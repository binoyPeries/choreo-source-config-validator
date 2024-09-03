const core = require("@actions/core");
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const {
  componentYamlSchemaV1D0,
  endpointYamlSchemaV0D1,
  componentConfigYamlSchemaV1beta1,
} = require("./schemas");

const SourceConfigFileTypes = {
  COMPONENT_YAML: "component.yaml",
  COMPONENT_CONFIG_YAML: "component-config.yaml",
  ENDPOINT_YAML: "endpoints.yaml",
};

function readInput() {
  sourceRootDir = core.getInput("source-root-dir-path");
  fileType = core.getInput("file-type");
  return [sourceRootDir, fileType];
}

function readSrcConfigYaml(filePath, fileType) {
  try {
    let fullPath = path.join(filePath, ".choreo");
    switch (fileType) {
      case SourceConfigFileTypes.COMPONENT_YAML:
        fullPath = path.join(fullPath, SourceConfigFileTypes.COMPONENT_YAML);
        break;
      case SourceConfigFileTypes.COMPONENT_CONFIG_YAML:
        fullPath = path.join(
          fullPath,
          SourceConfigFileTypes.COMPONENT_CONFIG_YAML
        );
        break;
      case SourceConfigFileTypes.ENDPOINT_YAML:
        fullPath = path.join(fullPath, SourceConfigFileTypes.ENDPOINT_YAML);
        break;
      default:
        throw new Error(`'${fileType}' is not a valid source config file type`);
    }
    let fileContent = fs.readFileSync(fullPath, "utf8");
    return fileContent;
  } catch (error) {
    throw new Error(`\nFailed to read source config file: ${error.message}`);
  }
}

function constructValidationErrorMessage(err, fileType) {
  const errors = err.errors;
  if (!errors || errors.length == 0) {
    return `Failed to validate ${fileType}, something went wrong:` + err;
  }
  const errorMsg = `${fileType} validation failed: `;
  const errorList =
    errors.length === 1 ? errors[0] : errors.map((e) => `\n- ${e}`).join("");
  return errorMsg + errorList;
}

async function validateSourceConfigFile(sourceRootDir, fileType) {
  try {
    switch (fileType) {
      case SourceConfigFileTypes.COMPONENT_YAML:
        await componentYamlSchemaV1D0(sourceRootDir).validate(
          srcConfigYamlFile,
          { abortEarly: false }
        );
        break;
      case SourceConfigFileTypes.COMPONENT_CONFIG_YAML:
        await componentConfigYamlSchemaV1beta1(sourceRootDir).validate(
          srcConfigYamlFile,
          { abortEarly: false }
        );
        break;
      case SourceConfigFileTypes.ENDPOINT_YAML:
        await endpointYamlSchemaV0D1(sourceRootDir).validate(
          srcConfigYamlFile,
          { abortEarly: false }
        );
        break;
      default:
        throw new Error(`'${fileType}' is not a valid source config file type`);
    }
    // Validate the component YAML file
  } catch (err) {
    throw new Error(constructValidationErrorMessage(err, fileType));
  }
}

async function main() {
  try {
    const [sourceRootDir, fileType] = readInput();
    const fileContent = readSrcConfigYaml(sourceRootDir, fileType);
    // Parse the yaml content
    srcConfigYamlFile = yaml.load(fileContent);
    await validateSourceConfigFile(sourceRootDir, fileType);
  } catch (error) {
    console.log("Validation Error: ", error.message);
    core.setFailed("source config file validation failed ", error.message);
  }
}

// Exec the main function
main();
