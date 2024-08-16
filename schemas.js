const yup = require("yup");
const github = require("@actions/github");
const fs = require("fs");

// constants
const ALLOWED_COMPONENT_YAML_VERSIONS = ["0.9", "1.0", "1.1"];
const ALLOWED_TYPES = ["REST", "GraphQL", "GRPC", "TCP", "UDP", "WS"];
const ALLOWED_NETWORK_VISIBILITIES = ["Public", "Private", "Organization"];
const BASE_PATH_REQUIRED_TYPES = ["REST", "GraphQL", "WS"];

// utils
function constructSchemaFilePath(srcDir, schemaFilePath) {
  const srcDirHasTrailingSlash = srcDir.endsWith("/");
  const schemaFilePathHasLeadingSlash = schemaFilePath.startsWith("/");
  if (srcDirHasTrailingSlash && schemaFilePathHasLeadingSlash) {
    return srcDir + schemaFilePath.substring(1);
  } else if (!(srcDirHasTrailingSlash || schemaFilePathHasLeadingSlash)) {
    return `${srcDir}/${schemaFilePath}`;
  }
  return srcDir + schemaFilePath;
}

// custom validators
// checkEndpointNameUniqueness - Custom validation method to check if endpoint names are unique
yup.addMethod(yup.array, "checkEndpointNameUniqueness", function () {
  return this.test({
    name: "unique-endpoint-name",
    test: (arr) => {
      const epSet = new Set();
      const isUnique = arr.every((ep) => {
        epName = ep.name;
        if (epSet.has(epName)) {
          return false;
        }
        epSet.add(epName);
        return true;
      });
      return (
        isUnique || new yup.ValidationError("Endpoint names must be unique.")
      );
    },
  });
});
// basePathRequired - Custom validation method to check base path is required for REST, GraphQL, and WS endpoints
yup.addMethod(yup.object, "basePathRequired", function () {
  return this.test({
    name: "base-path-required",
    test: (value, testCtx) => {
      const { type } = testCtx.parent;
      if (BASE_PATH_REQUIRED_TYPES.includes(type) && !value.basePath) {
        return new yup.ValidationError(
          "Base path is required for REST, GraphQL, and WS endpoints."
        );
      }
      return true;
    },
  });
}); // check if not needed
// SchemaFileExists - Custom validation method to check if the provided schema file exists
yup.addMethod(yup.string, "schemaFileExists", function (srcDir) {
  return this.test({
    name: "schema-file-exists",
    test: (value) => {
      schemaFilePath = constructSchemaFilePath(srcDir, value);
      try {
        const hasFile = fs.existsSync(schemaFilePath);
        return (
          hasFile ||
          new yup.ValidationError(
            `Schema file does not exist at the given path ${value}.`
          )
        );
      } catch (error) {
        console.log("Failed to check if schema file exists:", error.message);
      }
    },
  });
});

// Schema definitions
// serviceSchema - Schema for service definition
const serviceSchema = yup
  .object()
  .shape({
    basePath: yup.string().matches(/^\/[a-zA-Z0-9\/-]*$/, "Invalid base path"),
    port: yup
      .number()
      .required("Missing port number.")
      .moreThan(1000, "Port number must be greater than 1000.")
      .lessThan(65535, "Port number must be less than 65535."),
  })
  .required("service definition is required.")
  .basePathRequired();
// endpointSchema - Schema for endpoint definition
const endpointSchema = (srcDir) =>
  yup
    .array()
    .of(
      yup.object().shape({
        name: yup
          .string()
          .required("Endpoint name is required.")
          .max(50, "Endpoint name must be less than 50 characters.")
          .matches(
            /^[a-z0-9-]+$/, // cant start with a number
            "Endpoint name must only contain lowercase letters, digits, and hyphens."
          ),
        displayName: yup
          .string()
          .required()
          .max(50, "Display name must be less than 50 characters."),
        service: serviceSchema,
        type: yup
          .string()
          .required("Missing endpoint type.")
          .oneOf(ALLOWED_TYPES),
        networkVisibilities: yup
          .array()
          .of(yup.string().oneOf(ALLOWED_NETWORK_VISIBILITIES)),
        schemaFilePath: yup.string().schemaFileExists(srcDir),
      })
    )
    .checkEndpointNameUniqueness();

// componentYamlSchema - Schema for component.yaml
const componentYamlSchema = (srcDir) =>
  yup.object().shape({
    schemaVersion: yup
      .string()
      .required()
      .oneOf(ALLOWED_COMPONENT_YAML_VERSIONS),
    endpoints: endpointSchema(srcDir),
  });

module.exports = {
  componentYamlSchema,
};
