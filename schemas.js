const yup = require("yup");
const github = require("@actions/github");
const fs = require("fs");
const path = require("path");

// constants
const ALLOWED_TYPES = ["REST", "GraphQL", "GRPC", "TCP", "UDP", "WS"];
const ALLOWED_NETWORK_VISIBILITIES = ["Public", "Project", "Organization"];
const BASE_PATH_REQUIRED_TYPES = ["REST", "GraphQL", "WS"];
const COMPONENT_CONFIG_YAML_API_VERSION = ["core.choreo.dev/v1beta1"];
const COMPONENT_CONFIG_YAML_KIND = ["ComponentConfig"];
const PROJECT_ONLY_TYPES = ["GRPC", "TCP", "UDP"];
const PROJECT_VISIBILITY = "Project";
const LATEST_COMPONENT_YAML_SCHEMA_VERSION = 1.2;

// custom validators
// checkEndpointNameUniqueness - Custom validation method to check if endpoint names are unique
yup.addMethod(yup.array, "checkEndpointNameUniqueness", function () {
  return this.test({
    name: "unique-endpoint-name",
    test: (arr) => {
      // the endpoints section is optional, hence return true if it is not present
      if (!arr) {
        return true;
      }
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
        isUnique || new yup.ValidationError("Endpoint names must be unique")
      );
    },
  });
});

// check envVariableUniqueness - Custom validation method to check if env variable names are unique
yup.addMethod(yup.array, "checkEnvVariableUniqueness", function () {
  return this.test({
    name: "unique-env-variable-name",
    test: (arr) => {
      // the env section is optional, hence return true if it is not present
      if (!arr) {
        return true;
      }
      const envSet = new Set();
      const isUnique = arr.every((env) => {
        envName = env.name;
        if (envSet.has(envName)) {
          return false;
        }
        envSet.add(envName);
        return true;
      });
      return (
        isUnique ||
        new yup.ValidationError("Environment variable names must be unique")
      );
    },
  });
});

// contextRequired - Custom validation method to check context is required for REST, GraphQL, and WS endpoints
yup.addMethod(yup.string, "contextRequired", function () {
  return this.test({
    name: "context-required",
    test: (value, testCtx) => {
      const { type } = testCtx.parent;
      if (BASE_PATH_REQUIRED_TYPES.includes(type) && !value) {
        return new yup.ValidationError(
          `${testCtx.path} is required for ${type}-type endpoints`
        );
      }
      return true;
    },
  });
});

// SchemaFileExists - Custom validation method to check if the provided schema file exists
yup.addMethod(yup.string, "schemaFileExists", function (srcDir) {
  return this.test({
    name: "schema-file-exists",
    test: (value) => {
      // schema file path is optional, hence return true if it is not present
      if (!value) {
        return true;
      }
      schemaFilePath = path.join(srcDir, value);
      try {
        const hasFile = fs.existsSync(schemaFilePath);
        return (
          hasFile ||
          new yup.ValidationError(
            `Schema file does not exist at the given path ${value}.`
          )
        );
      } catch (error) {
        new yup.ValidationError(
          "Failed to check if schema file exists:",
          error.message
        );
      }
    },
  });
});

// validateServiceName - Custom validation method to validate service name
yup.addMethod(yup.string, "validateServiceName", function () {
  return this.test({
    name: "validate-service-name",
    test: (value, testCtx) => {
      const alphanumericRegex = "[a-zA-Z0-9_-]+";
      const choreoSvcRefNameRegex = new RegExp(
        `^choreo:\/\/\/${alphanumericRegex}\/${alphanumericRegex}\/${alphanumericRegex}\/${alphanumericRegex}\/v\\d+(\\.\\d+)?\/(PUBLIC|PROJECT|ORGANIZATION)$`
      );
      const thirdPartySvcRefNameRegex = new RegExp(
        "^thirdparty:([a-zA-Z0-9\\s_.-]+)\/([vV]\\d+(\\.\\d+)*)$"
      );
      const dbSvcRefNameRegex = new RegExp(
        "^database:(([a-zA-Z0-9_-]+)\/)?([a-zA-Z0-9_-]+)$"
      );
      if (value.startsWith("choreo:///")) {
        return (
          choreoSvcRefNameRegex.test(value) ||
          new yup.ValidationError(
            `${testCtx.path} has an invalid service identifier. ` +
              `Use the format choreo:///<org-handle>/<project-handle>/<component-handle>/<endpoint-identifier>/<major-version>/<network-visibility>`
          )
        );
      }
      if (value.startsWith("thirdparty:")) {
        return (
          thirdPartySvcRefNameRegex.test(value) ||
          new yup.ValidationError(
            `${testCtx.path} has an invalid service identifier. ` +
              `Use the format thirdparty:<service_name>/<version>, ` +
              `allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.`
          )
        );
      }
      if (value.startsWith("database:")) {
        return (
          dbSvcRefNameRegex.test(value) ||
          new yup.ValidationError(
            `${testCtx.path} has an invalid service identifier. ` +
              `Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, ` +
              `allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.`
          )
        );
      }
      return new yup.ValidationError(
        `${testCtx.path} has an invalid service identifier. It can only contain choreo, thirdparty, or database types.`
      );
    },
  });
});

// validateResourceRef - Custom validation method to validate resourceRef of connectionReferences
yup.addMethod(yup.string, "validateResourceRef", function () {
  return this.test({
    name: "validate-resource-ref",
    test: (value, testCtx) => {
         // [service:][/project-handle/]component-handle/major-version[/endpoint-handle][/network-visibility]
      const svcRefNameRegex = new RegExp("^(service:)?(\/([a-zA-Z0-9_-]+)\/)?([a-zA-Z0-9_-]+)\/([vV]?\\d+(\\.\\d+)*)(\/([a-zA-Z0-9_-]+))?(\/(PUBLIC|PROJECT|ORGANIZATION))?$"
      );
      const thirdPartySvcRefNameRegex = new RegExp(
        "^thirdparty:([a-zA-Z0-9\\s_.-]+)\/([vV]\\d+(\\.\\d+)*)$"
      );
      const dbSvcRefNameRegex = new RegExp(
        "^database:(([a-zA-Z0-9_-]+)\/)?([a-zA-Z0-9_-]+)$"
      );
      if (value.startsWith("service:")) {
        return (
          svcRefNameRegex.test(value) ||
          new yup.ValidationError(
            `${testCtx.path} has an invalid service identifier. ` +
              `Use the format [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>] where optional fields are specified in brackets.`
          )
        )
      }
      if (value.startsWith("thirdparty:")) {
        return (
          thirdPartySvcRefNameRegex.test(value) ||
          new yup.ValidationError(
            `${testCtx.path} has an invalid service identifier. ` +
              `Use the format thirdparty:<service_name>/<version>, ` +
              `allowing only alphanumeric characters, periods (.), underscores (_), hyphens (-), and slashes (/) after thirdparty:.`
          )
        );
      }
      if (value.startsWith("database:")) {
        return (
          dbSvcRefNameRegex.test(value) ||
          new yup.ValidationError(
            `${testCtx.path} has an invalid service identifier. ` +
              `Use the format database:[<serverName>/]<databaseName> where optional fields are in brackets, ` +
              `allowing only alphanumeric characters, underscores (_), hyphens (-), and slashes (/) after database:.`
          )
        );
      }
      return (
        // since "service:" is optional, we need to validate again with a generic error
        svcRefNameRegex.test(value) ||
        new yup.ValidationError(
          `${testCtx.path} has an invalid service identifier. ` +
            `For services, use [service:][/<project-handle>/]<component-handle>/<major-version>[/<endpoint-handle>][/<network-visibility>]. ` +
            `For databases, use database:[<serverName>/]<databaseName>. ` +
            `For third-party services, use thirdparty:<service_name>/<version>. ` +
            `Optional fields are specified in brackets.`
        )
      );
    },
  });
});

// projectVisibilityOnly - Custom validation method to check if for types GRPC, TCP, and UDP, networkVisibility can only be project
yup.addMethod(yup.array, "projectVisibilityOnly", function () {
  return this.test({
    name: "project-visibility-only",
    test: (visibility, testCtx) => {
      const { type } = testCtx.parent;
      const isVisibilityProjectOnly = visibility?.length === 1 && visibility[0] === PROJECT_VISIBILITY;
      const isTypeProjectOnly = PROJECT_ONLY_TYPES.includes(type);
      
      if (isTypeProjectOnly && !isVisibilityProjectOnly) {
        // Extract "endpoints[x]" from "endpoints[x].networkVisibilities"
        erroredEndpoint = testCtx.path.split(".")[0] || "endpoint";
        return new yup.ValidationError(
          `The ${erroredEndpoint} is a type ${type} endpoint and can only have networkVisibility set to ${PROJECT_VISIBILITY}`
        );
      }
      return true;
    },
  });
});

// Schema definitions
// NOTE: specified schema versions are aligned with Rudder component schema versions
// serviceSchema - Schema for service definition
const serviceSchema = yup
  .object()
  .shape({
    basePath: yup
      .string()
      .matches(
        /^\/[a-zA-Z0-9\/\-_]*$/,
        ({ path }) =>
          `${path} must start with a forward slash and can only contain alphanumeric characters, hyphens, underscores and forward slashes.`
      ),
    port: yup.number().required().moreThan(1000).lessThan(65535),
  })
  .required();

// endpointSchemaV0D1 - Schema for endpoint definition V0.1
const endpointSchemaV0D1 = (srcDir) =>
  yup.array().of(
    yup.object().shape({
      name: yup.string().required(),
      port: yup.number().required().moreThan(1000).lessThan(65535),
      type: yup.string().required().oneOf(ALLOWED_TYPES),
      networkVisibility: yup.string().oneOf(ALLOWED_NETWORK_VISIBILITIES),
      context: yup
        .string()
        .contextRequired()
        .matches(
          /^\/[a-zA-Z0-9\/\-_]*$/,
          ({ path }) =>
            `${path} must start with a forward slash and can only contain alphanumeric characters, hyphens, and forward slashes.`
        ),
      schemaFilePath: yup.string().schemaFileExists(srcDir),
    })
  );

// endpointSchemaV0D2 - Schema for endpoint definition V0.2
const endpointSchemaV0D2 = (srcDir) =>
  yup
    .array()
    .of(
      yup.object().shape({
        name: yup
          .string()
          .required()
          .max(50)
          .matches(
            /^[a-z][a-z0-9_-]*$/,
            ({ path }) =>
              `${path} must start with a lowercase letter and can only contain lowercase letters, numbers, underscores (_), and hyphens (-).`
          ),
        displayName: yup.string().max(50),
        service: serviceSchema,
        type: yup.string().required().oneOf(ALLOWED_TYPES),
        networkVisibilities: yup
          .array()
          .of(yup.string().oneOf(ALLOWED_NETWORK_VISIBILITIES))
          .projectVisibilityOnly(),
        schemaFilePath: yup.string().schemaFileExists(srcDir),
      })
    )
    .checkEndpointNameUniqueness();

// serviceReferencesSchema - Schema for service references
const serviceReferencesSchema = yup.array().of(
  yup.object().shape({
    name: yup.string().required().validateServiceName(),
    connectionConfig: yup.string().uuid().required(),
    env: yup
      .array()
      .of(
        yup.object().shape({
          from: yup.string().required(),
          to: yup.string().required(),
        })
      )
      .required(),
  })
);

// connectionReferencesSchema - Schema for connection references
const connectionReferencesSchema = yup.array().of(
  yup.object().shape({
    name: yup.string().required().matches(
      /^[\s]*(?!.*[^a-zA-Z0-9][^a-zA-Z0-9])[a-zA-Z0-9][a-zA-Z0-9 _\-.]{1,48}[a-zA-Z0-9][\s]*$/,
      ({ path }) =>
        `${path} can only contain letters, numbers, with non-consecutive delimiters: underscores (_), hyphens (-), dots (.), or spaces.`
    ),
    resourceRef: yup.string().required().validateResourceRef(),
  })
);

// dependencySchemaV0D1 - Schema for dependency definition V0.1
const dependencySchemaV0D1 = yup.object().shape({
  serviceReferences: serviceReferencesSchema,
});

// dependencySchemaV0D2 - Schema for dependency definition V0.2
const dependencySchemaV0D2 = yup.object().shape({
  serviceReferences: serviceReferencesSchema,
  connectionReferences: connectionReferencesSchema,
});

const connectionRefSchema = yup.object().shape({
  name: yup.string().required(),
  key: yup.string().required(),
}).nullable().default(null);

const configGroupRefSchema = yup.object().shape({
  name: yup.string().required(),
  key: yup.string().required(),
}).nullable().default(null);

const configFormSchema = yup.object().shape({
  displayName: yup.string(),
  required: yup.boolean(),
  type: yup.string(),
}).nullable().default(null);

// envVariableSchemaV0D1 - Schema for environment variable definition V0.1
const envVariableSchemaV0D1 = yup.object().shape({
  name: yup.string().required().matches(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    "Environment variable name must start with a letter or underscore and can only contain letters, numbers, and underscores."),
  value: yup.string(),
  valueFrom: yup
    .object()
    .shape({
      connectionRef: connectionRefSchema,
      configGroupRef: configGroupRefSchema,
    }),
}).test(
  "oneOfRequired",
  "One of value, connectionRef or configGroupRef must be provided",
  function (envVariable) {
    return envVariable?.value || envVariable?.valueFrom?.configGroupRef || envVariable?.valueFrom?.connectionRef;
  }
);

// envVariableSchemaV0D2 - Schema for environment variable definition V0.2
const envVariableSchemaV0D2 = yup.object().shape({
  name: yup.string().required().matches(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    "Environment variable name must start with a letter or underscore and can only contain letters, numbers, and underscores."),
  value: yup.string(),
  valueFrom: yup
    .object()
    .shape({
      connectionRef: connectionRefSchema,
      configGroupRef: configGroupRefSchema,
      configForm: configFormSchema,
    }),
}).test(
  "oneOfRequired",
  "One of value, connectionRef, configGroupRef  or configForm must be provided",
  function (envVariable) {
    return envVariable?.value || envVariable?.valueFrom?.configGroupRef || envVariable?.valueFrom?.connectionRef || envVariable?.valueFrom?.configForm ;
  }
);

// configurationSchemaV0D1 - Schema for configuration definition V0.1
const configurationSchemaV0D1 = yup.object().shape({
  env: yup.array().of(envVariableSchemaV0D1).checkEnvVariableUniqueness(),
});

// configurationSchemaV1D2 - Schema for configuration definition V1.2
const configurationSchemaV0D2 = yup.object().shape({
  env: yup.array().of(envVariableSchemaV0D2).checkEnvVariableUniqueness(),
});


// specSchema - Schema for spec definition
const specSchema = (srcDir) =>
  yup.object().shape({
    inbound: endpointSchemaV0D1(srcDir).min(0),
    outbound: dependencySchemaV0D1,
  });

// componentYamlSchemaV1D0 - Schema for component.yaml v1.0
const componentYamlSchemaV1D0 = (srcDir) =>
  yup.object().shape({
    schemaVersion: yup
      .number()
      .required()
      .oneOf([1.0], "Schema version must be 1.0"),
    endpoints: endpointSchemaV0D2(srcDir),
    dependencies: dependencySchemaV0D1,
  });

// componentYamlSchemaV1D1 - Schema for component.yaml v1.1
const componentYamlSchemaV1D1 = (srcDir) =>
  yup.object().shape({
    schemaVersion: yup
      .number()
      .required()
      .oneOf([1.1], "Schema version must be 1.1"),
    endpoints: endpointSchemaV0D2(srcDir),
    dependencies: dependencySchemaV0D2,
    configuration: configurationSchemaV0D1,
    configurations: configurationSchemaV0D1,
  });

// componentYamlSchemaV1D1 - Schema for component.yaml v1.2
const componentYamlSchemaV1D2 = (srcDir) =>
  yup.object().shape({
    schemaVersion: yup
      .number()
      .required()
      .oneOf([1.2], "Schema version must be 1.2"),
    endpoints: endpointSchemaV0D2(srcDir),
    dependencies: dependencySchemaV0D2,
    configuration: configurationSchemaV0D2,
    configurations: configurationSchemaV0D2,
  });

// endpointYamlSchema - Schema for endpoints.yaml
const endpointYamlSchemaV0D1 = (srcDir) =>
  yup.object().shape({
    version: yup.string().required(),
    endpoints: endpointSchemaV0D1(srcDir).required().min(0),
  });

// componentConfigYamlSchemaV1D0 - Schema for component-config.yaml
const componentConfigYamlSchemaV1beta1 = (srcDir) =>
  yup.object().shape({
    apiVersion: yup
      .string()
      .required()
      .oneOf(COMPONENT_CONFIG_YAML_API_VERSION),
    kind: yup.string().required().equals(COMPONENT_CONFIG_YAML_KIND),
    spec: specSchema(srcDir),
  });

module.exports = {
  componentYamlSchemaV1D2,
  componentYamlSchemaV1D1,
  componentYamlSchemaV1D0,
  endpointYamlSchemaV0D1,
  componentConfigYamlSchemaV1beta1,
  LATEST_COMPONENT_YAML_SCHEMA_VERSION,
};
