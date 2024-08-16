const core = require("@actions/core");
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const { componentYamlSchema } = require("./schemas");

function readInput() {
  try {
    sourceRootDir = core.getInput("source-root-dir-path");
    return sourceRootDir;
  } catch (error) {
    throw new Error(`Failed to read input: ${error.message}`);
  }
}

function readComponentYaml(filePath) {
  try {
    fullPath = path.join(filePath, ".choreo", "component.yaml");
    let fileContent = fs.readFileSync(fullPath, "utf8");
    return fileContent;
  } catch (error) {
    throw new Error(`Failed to read component.yaml: ${error.message}`);
  }
}

function constructValidationErrorMessage(errors) {
  let errorMessage = "Failed to validate component.yaml";
  if (errors.length == 0) {
    return errorMessage;
  }
  const errorList =
    errors.length === 1 ? errors[0] : errors.map((e) => `\n- ${e}`).join("");
  return `${errorMessage}: ${errorList}`;
}

async function validateComponentYaml(sourceRootDir) {
  try {
    // Validate the component YAML file
    await componentYamlSchema(sourceRootDir).validate(componentYamlFile, {
      abortEarly: false,
    });
  } catch (err) {
    throw new Error(constructValidationErrorMessage(err.errors));
  }
}

async function main() {
  try {
    const sourceRootDir = readInput();
    const fileContent = readComponentYaml(sourceRootDir);
    // Parse the yaml content
    componentYamlFile = yaml.load(fileContent);
    await validateComponentYaml(sourceRootDir);
  } catch (error) {
    console.log("component.yaml validation failed: ", error.message);
    core.setFailed("component.yaml validation failed: ", error.message);
  }
}

// Exec the main function
main();
