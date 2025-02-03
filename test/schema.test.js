const {
  endpointYamlSchemaV0D1,
  componentYamlSchemaV1D0,
  componentYamlSchemaV1D1,
  componentConfigYamlSchemaV1beta1,
} = require("../schemas.js");
const yaml = require("js-yaml");
const {
  validEndpointsYaml,
  missingRequiredFieldsEndpointsYaml,
  invalidPortEndpointsYaml,
  validateTypeFieldYaml,
  validateVisibilityFieldYaml,
  validateContextFieldYaml,
  validateContextRequiredScenariosYaml,
  validateSchemaFilePathYaml,
} = require("./endpoints-yaml-samples.js");
const {
  validComponentYaml,
  missingRequiredFieldsComponentYaml,
  validateEndpointName,
  validateEndpointDisplayName,
  validateServiceSchema,
  validateTypeField,
  validateNetworkVisibilityField,
  validateSchemaFilePath,
  validateServiceReferenceName,
  validateServiceReferenceConnectionConfig,
  validateServiceReferenceEnv,
  validateConnectionReferenceName,
  validateConnectionReferenceResourceRef,
  validateConfigurations,
  validComponentYamlV1D1,
  validateProjectVisibilityOnlyType,
} = require("./component-yaml-samples.js");

const testSrcDir = "test/";
const COMPONENT_YAML = "component.yaml";
const ENDPOINTS_YAML = "endpoints.yaml";
const COMPONENT_CONFIG_YAML = "component-config.yaml";
const ALLOWED_COMPONENT_YAML_VERSIONS = [1.0, 1.1];

async function validateEndpointsSchema(yamlContent) {
  return await endpointYamlSchemaV0D1(testSrcDir).validate(
    yaml.load(yamlContent),
    {
      abortEarly: false,
    }
  );
}
async function validateComponentYamlSchema(yamlContent, schemaVersion) {
  switch (schemaVersion) {
    case 1.0:
      return await componentYamlSchemaV1D0(testSrcDir).validate(
        yaml.load(yamlContent),
        {
          abortEarly: false,
        }
      );
    case 1.1:
      return await componentYamlSchemaV1D1(testSrcDir).validate(
        yaml.load(yamlContent),
        {
          abortEarly: false,
        }
      );
    default:
      throw new Error("Invalid schema version");
  }
}

async function validateComponentConfigSchema(yamlContent) {
  return await componentConfigYamlSchemaV1beta1(testSrcDir).validate(
    yaml.load(yamlContent),
    {
      abortEarly: false,
    }
  );
}
async function expectValidationErrors(
  yamlType,
  yamlContent,
  expectedErrors,
  schemaVersion = ALLOWED_COMPONENT_YAML_VERSIONS[0]
) {
  try {
    switch (yamlType) {
      case COMPONENT_YAML:
        await validateComponentYamlSchema(yamlContent, schemaVersion);
        break;
      case ENDPOINTS_YAML:
        await validateEndpointsSchema(yamlContent);
        break;
      case COMPONENT_CONFIG_YAML:
        await validateComponentConfigSchema(yamlContent);
        break;
      default:
        throw new Error("Invalid yaml type");
    }
    throw new Error("Validation should have failed but did not.");
  } catch (error) {
    if (!error.errors) {
      throw new Error(error.message);
    }
    expect(error.errors).toEqual(expectedErrors);
  }
}

describe("endpointYamlSchemaV0D1 schema tests", () => {
  test("should validate correctly with valid endpoints.yaml", async () => {
    const result = await validateEndpointsSchema(validEndpointsYaml);
    expect(result).toBeDefined();
  });

  test("should fail validation when required fields (version, name, port, type) are missing", async () => {
    const expectedErrors = [
      "version is a required field",
      "endpoints[0].name is a required field",
      "endpoints[0].port is a required field",
      "endpoints[0].type is a required field",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      missingRequiredFieldsEndpointsYaml,
      expectedErrors
    );
  });

  test("should fail when port is less than 1000 or greater than 65535", async () => {
    const expectedErrors = [
      "endpoints[0].port must be greater than 1000",
      "endpoints[1].port must be less than 65535",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      invalidPortEndpointsYaml,
      expectedErrors
    );
  });

  test("should fail when type is not one of REST, GraphQL, GRPC, UDP, TCP, WS", async () => {
    const expectedErrors = [
      "endpoints[6].type must be one of the following values: REST, GraphQL, GRPC, TCP, UDP, WS",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      validateTypeFieldYaml,
      expectedErrors
    );
  });

  test("should fail when network visibility is not one of Project, Organization, Public ", async () => {
    const expectedErrors = [
      "endpoints[3].networkVisibility must be one of the following values: Public, Project, Organization",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      validateVisibilityFieldYaml,
      expectedErrors
    );
  });

  test(`should fail when context doesn't start with a forward slash and can only
    contain alphanumeric characters, hyphens, and forward slashes`, async () => {
    const expectedErrors = [
      "endpoints[1].context must start with a forward slash and can only contain alphanumeric characters, hyphens, and forward slashes.",
      "endpoints[3].context must start with a forward slash and can only contain alphanumeric characters, hyphens, and forward slashes.",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      validateContextFieldYaml,
      expectedErrors
    );
  });

  test("should fail when context is not provided for endpoint types REST, GraphQl, WS", async () => {
    const expectedErrors = [
      "endpoints[0].context is required for REST-type endpoints",
      "endpoints[1].context is required for GraphQL-type endpoints",
      "endpoints[2].context is required for WS-type endpoints",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      validateContextRequiredScenariosYaml,
      expectedErrors
    );
  });

  test("should fail when schema file does not exist in the give path", async () => {
    const expectedErrors = [
      "Schema file does not exist at the given path invalid-path.yaml.",
    ];
    await expectValidationErrors(
      ENDPOINTS_YAML,
      validateSchemaFilePathYaml,
      expectedErrors
    );
  });
});

describe("componentYamlSchemaV1D0 schema tests", () => {
  test("should validate correctly with valid component.yaml", async () => {
    const result = await validateComponentYamlSchema(
      validComponentYaml,
      ALLOWED_COMPONENT_YAML_VERSIONS[0]
    );
    expect(result).toBeDefined();
  });
  test("should fail when required fields (schemaVersion, endpoint name, type and port) are missing", async () => {
    const expectedErrors = [
      "schemaVersion is a required field",
      "endpoints[0].name is a required field",
      "endpoints[0].service.port is a required field",
      "endpoints[0].type is a required field",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      missingRequiredFieldsComponentYaml,
      expectedErrors
    );
  });
  test("should fail when UDP,TCP and GRPC have visibility other than project", async () => {
    const expectedErrors = [
      "endpoints[4].networkVisibilities is a type UDP endpoint and can only have networkVisibility as Project",
      "endpoints[5].networkVisibilities is a type TCP endpoint and can only have networkVisibility as Project",
      "endpoints[6].networkVisibilities is a type GRPC endpoint and can only have networkVisibility as Project",
      "endpoints[7].networkVisibilities is a type UDP endpoint and can only have networkVisibility as Project",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateProjectVisibilityOnlyType,
      expectedErrors
    );
  });
  test("should fail when endpoint name not valid and unique", async () => {
    const expectedErrors = [
      "endpoints[2].name must start with a lowercase letter and can only contain lowercase letters, numbers, underscores (_), and hyphens (-).",
      "endpoints[3].name must start with a lowercase letter and can only contain lowercase letters, numbers, underscores (_), and hyphens (-).",
      "endpoints[5].name must be at most 50 characters",
      "Endpoint names must be unique",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateEndpointName,
      expectedErrors
    );
  });
  test("should fail when endpoint display name is not valid", async () => {
    const expectedErrors = [
      "endpoints[2].displayName must be at most 50 characters",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateEndpointDisplayName,
      expectedErrors
    );
  });
  test("should fail when service schema section is not valid", async () => {
    const expectedErrors = [
      "endpoints[0].service.port must be greater than 1000",
      "endpoints[1].service.basePath must start with a forward slash and can only contain alphanumeric characters, hyphens, underscores and forward slashes.",
      "endpoints[1].service.port must be less than 65535",
      "endpoints[2].service.basePath must start with a forward slash and can only contain alphanumeric characters, hyphens, underscores and forward slashes.",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateServiceSchema,
      expectedErrors
    );
  });
  test("should fail when type is not one of REST, GraphQL, GRPC, UDP, TCP, WS", async () => {
    const expectedErrors = [
      "endpoints[6].type must be one of the following values: REST, GraphQL, GRPC, TCP, UDP, WS",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateTypeField,
      expectedErrors
    );
  });
  test("should fail whe network visibilities is not an array containing any combination of Public, Organization, or Project", async () => {
    const expectedErrors = [
      "endpoints[7].networkVisibilities[1] must be one of the following values: Public, Project, Organization",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateNetworkVisibilityField,
      expectedErrors
    );
  });
  test("should fail when schema file does not exist in the give path", async () => {
    const expectedErrors = [
      "Schema file does not exist at the given path wrong-openapi.yaml.",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateSchemaFilePath,
      expectedErrors
    );
  });
  test("should fail when service reference name is not valid", async () => {
    const expectedErrors = [
      "dependencies.serviceReferences[2].name has an invalid service identifier. Use the format choreo:///<org-handle>/<project-handle>/<component-handle>/<endpoint-identifier>/<major-version>/<network-visibility>",
      "dependencies.serviceReferences[3].name has an invalid service identifier. It can only contain choreo, thirdparty, or database types.",
      "dependencies.serviceReferences[5].name has an invalid service identifier. Use the format thirdparty:<service_name>/<version>, allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.",
      "dependencies.serviceReferences[6].name has an invalid service identifier. Use the format thirdparty:<service_name>/<version>, allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.",
      "dependencies.serviceReferences[8].name has an invalid service identifier. Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.",
      "dependencies.serviceReferences[9].name has an invalid service identifier. Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateServiceReferenceName,
      expectedErrors
    );
  });
  test("should fail when service reference connection config is not valid", async () => {
    const expectedErrors = [
      "dependencies.serviceReferences[0].connectionConfig is a required field",
      "dependencies.serviceReferences[1].connectionConfig must be a valid UUID",
      "dependencies.serviceReferences[2].connectionConfig must be a valid UUID",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateServiceReferenceConnectionConfig,
      expectedErrors
    );
  });
  test("should fail when service reference env is not valid", async () => {
    const expectedErrors = [
      "dependencies.serviceReferences[0].env is a required field",
      "dependencies.serviceReferences[1].env[0].to is a required field",
      "dependencies.serviceReferences[2].env[0].from is a required field",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateServiceReferenceEnv,
      expectedErrors
    );
  });
});

// Tests for connection reference dependencies of componentYamlV1D1
describe("dependencySchemaV0D2 schema tests", () => {
  test("should fail when connection reference name is not valid", async () => {
    const expectedErrors = [
      "dependencies.connectionReferences[0].name is a required field",
      "dependencies.connectionReferences[2].name can only contain letters, numbers, with non-consecutive delimiters: underscores (_), hyphens (-), dots (.), or spaces.",
      "dependencies.connectionReferences[4].name can only contain letters, numbers, with non-consecutive delimiters: underscores (_), hyphens (-), dots (.), or spaces.",
      "dependencies.connectionReferences[6].name can only contain letters, numbers, with non-consecutive delimiters: underscores (_), hyphens (-), dots (.), or spaces.",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateConnectionReferenceName,
      expectedErrors,
      ALLOWED_COMPONENT_YAML_VERSIONS[1]
    );
  });
  test("should fail when connection reference resourceRef is not valid", async () => {
    const expectedErrors = [
      "dependencies.connectionReferences[0].resourceRef is a required field",
      "dependencies.connectionReferences[2].resourceRef has an invalid service identifier. Use the format [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>] where optional fields are specified in brackets.",
      "dependencies.connectionReferences[3].resourceRef has an invalid service identifier. Use the format [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>] where optional fields are specified in brackets.",
      "dependencies.connectionReferences[5].resourceRef has an invalid service identifier. For services, use [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>]. For databases, use database:[<serverName>/]<databaseName>. For third-party services, use thirdparty:<service_name>/<version>. Optional fields are specified in brackets.",
      "dependencies.connectionReferences[9].resourceRef has an invalid service identifier. For services, use [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>]. For databases, use database:[<serverName>/]<databaseName>. For third-party services, use thirdparty:<service_name>/<version>. Optional fields are specified in brackets.",
      "dependencies.connectionReferences[11].resourceRef has an invalid service identifier. For services, use [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>]. For databases, use database:[<serverName>/]<databaseName>. For third-party services, use thirdparty:<service_name>/<version>. Optional fields are specified in brackets.",
      "dependencies.connectionReferences[14].resourceRef has an invalid service identifier. Use the format thirdparty:<service_name>/<version>, allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.",
      "dependencies.connectionReferences[15].resourceRef has an invalid service identifier. Use the format thirdparty:<service_name>/<version>, allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.",
      "dependencies.connectionReferences[16].resourceRef has an invalid service identifier. Use the format thirdparty:<service_name>/<version>, allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.",
      "dependencies.connectionReferences[18].resourceRef has an invalid service identifier. Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.",
      "dependencies.connectionReferences[19].resourceRef has an invalid service identifier. Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.",
      "dependencies.connectionReferences[20].resourceRef has an invalid service identifier. Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.",
      "dependencies.connectionReferences[21].resourceRef has an invalid service identifier. For services, use [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>]. For databases, use database:[<serverName>/]<databaseName>. For third-party services, use thirdparty:<service_name>/<version>. Optional fields are specified in brackets.",
    ];
    await expectValidationErrors(
      COMPONENT_YAML,
      validateConnectionReferenceResourceRef,
      expectedErrors,
      ALLOWED_COMPONENT_YAML_VERSIONS[1]
    );
  });
});

// describe("componentYamlSchemaV1D1 schema tests", () => {
test("should validate correctly with valid component.yaml v1.1", async () => {
  const result = await validateComponentYamlSchema(
    validComponentYamlV1D1,
    ALLOWED_COMPONENT_YAML_VERSIONS[1]
  );
  expect(result).toBeDefined();
});
test("should fail when configuration is not valid", async () => {
  const expectedErrors = [
    "configuration.env[0].valueFrom.connectionRef.key is a required field",
    "One of value, connectionRef or configGroupRef must be provided",
    "configuration.env[4].valueFrom.connectionRef.name is a required field",
    "configuration.env[5].valueFrom.configGroupRef.key is a required field",
    "One of value, connectionRef or configGroupRef must be provided",
    "Environment variable name must start with a letter or underscore and can only contain letters, numbers, and underscores.",
    "Environment variable names must be unique",
  ];
  await expectValidationErrors(
    COMPONENT_YAML,
    validateConfigurations,
    expectedErrors,
    ALLOWED_COMPONENT_YAML_VERSIONS[1]
  );
});
