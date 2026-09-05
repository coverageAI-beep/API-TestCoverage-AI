import { load as yamlLoad } from 'js-yaml';
import type { ApiSpec, ApiEndpoint, ApiEndpointError, ApiEndpointParam, ApiAuthType } from '../types';

export interface ParseResult {
  success: boolean;
  spec?: Partial<ApiSpec>;
  error?: string;
}

export function parseOpenApiSpec(rawText: string, projectId: string): ParseResult {
  try {
    let parsed: any;
    const trimmed = rawText.trim();

    if (!trimmed) {
      return { success: false, error: 'Spec content is empty' };
    }

    // Attempt JSON parse first, fallback to YAML
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = yamlLoad(trimmed);
      }
    } else {
      parsed = yamlLoad(trimmed);
    }

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid OpenAPI document: parsed object is empty' };
    }

    // Check version: OpenAPI 3.x or Swagger 2.0
    const isOpenApi3 = Boolean(parsed.openapi && parsed.openapi.startsWith('3'));
    const isSwagger2 = Boolean(parsed.swagger && parsed.swagger.startsWith('2'));

    if (!isOpenApi3 && !isSwagger2 && !parsed.paths) {
      return {
        success: false,
        error: 'Unrecognized specification format. Expected OpenAPI 3.x or Swagger 2.0 with a "paths" object.',
      };
    }

    const title = parsed.info?.title || 'Imported API Specification';
    const description = parsed.info?.description || '';
    const version = parsed.info?.version || '1.0.0';

    // Base URL determination
    let baseUrl = '';
    if (isOpenApi3 && Array.isArray(parsed.servers) && parsed.servers.length > 0) {
      baseUrl = parsed.servers[0]?.url || '';
    } else if (isSwagger2) {
      const scheme = parsed.schemes?.[0] || 'https';
      const host = parsed.host || 'api.example.com';
      const basePath = parsed.basePath || '';
      baseUrl = `${scheme}://${host}${basePath}`;
    }

    // Determine authentication type
    let authType: ApiAuthType = 'none';
    let authDetails = '';
    const securitySchemes = parsed.components?.securitySchemes || parsed.securityDefinitions || {};
    const schemeKeys = Object.keys(securitySchemes);
    if (schemeKeys.length > 0) {
      const firstScheme = securitySchemes[schemeKeys[0]];
      if (firstScheme?.type === 'http' && firstScheme.scheme === 'bearer') {
        authType = 'bearer';
        authDetails = `Bearer JWT (${firstScheme.bearerFormat || 'JWT'})`;
      } else if (firstScheme?.type === 'apiKey') {
        authType = 'apiKey';
        authDetails = `API Key in ${firstScheme.in || 'header'} (${firstScheme.name || 'X-API-Key'})`;
      } else if (firstScheme?.type === 'oauth2') {
        authType = 'oauth2';
        authDetails = 'OAuth 2.0 Authorization Flow';
      } else if (firstScheme?.type === 'basic' || (firstScheme?.type === 'http' && firstScheme.scheme === 'basic')) {
        authType = 'basic';
        authDetails = 'HTTP Basic Authentication';
      }
    }

    // Extract endpoints
    const endpoints: ApiEndpoint[] = [];
    const validationRulesList: string[] = [];
    const businessRulesList: string[] = [];

    if (parsed.paths && typeof parsed.paths === 'object') {
      for (const [pathKey, pathItem] of Object.entries(parsed.paths)) {
        if (!pathItem || typeof pathItem !== 'object') continue;

        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

        for (const method of methods) {
          const operation = (pathItem as any)[method];
          if (!operation) continue;

          const endpointId = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const summary = operation.summary || operation.operationId || `${method.toUpperCase()} ${pathKey}`;
          const opDescription = operation.description || '';

          // Parameters
          const parameters: ApiEndpointParam[] = [];
          const allParams = [...((pathItem as any).parameters || []), ...(operation.parameters || [])];

          for (const param of allParams) {
            if (param && param.name) {
              parameters.push({
                name: param.name,
                in: param.in || 'query',
                required: Boolean(param.required),
                type: param.schema?.type || param.type || 'string',
                description: param.description || '',
              });

              if (param.required) {
                validationRulesList.push(`${pathKey} [${method.toUpperCase()}]: Parameter '${param.name}' is mandatory.`);
              }
            }
          }

          // Request schema
          let requestSchema = '';
          if (operation.requestBody?.content?.['application/json']?.schema) {
            try {
              requestSchema = JSON.stringify(operation.requestBody.content['application/json'].schema, null, 2);
            } catch {
              requestSchema = '{}';
            }
          } else if (operation.parameters) {
            const bodyParam = operation.parameters.find((p: any) => p.in === 'body');
            if (bodyParam?.schema) {
              try {
                requestSchema = JSON.stringify(bodyParam.schema, null, 2);
              } catch {
                requestSchema = '{}';
              }
            }
          }

          // Responses
          let responseSchema = '';
          let responseStatusCode = 200;
          const errorResponses: ApiEndpointError[] = [];

          if (operation.responses && typeof operation.responses === 'object') {
            for (const [statusCodeStr, respObj] of Object.entries(operation.responses)) {
              const codeNum = parseInt(statusCodeStr, 10);
              const resp = respObj as any;
              const respDesc = resp?.description || '';

              if (codeNum >= 200 && codeNum < 300) {
                responseStatusCode = isNaN(codeNum) ? 200 : codeNum;
                const schemaObj = resp?.content?.['application/json']?.schema || resp?.schema;
                if (schemaObj) {
                  try {
                    responseSchema = JSON.stringify(schemaObj, null, 2);
                  } catch {
                    responseSchema = '{}';
                  }
                }
              } else if (codeNum >= 400) {
                let errSchema = '';
                const schemaObj = resp?.content?.['application/json']?.schema || resp?.schema;
                if (schemaObj) {
                  try {
                    errSchema = JSON.stringify(schemaObj, null, 2);
                  } catch {
                    errSchema = '';
                  }
                }
                errorResponses.push({
                  id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  statusCode: isNaN(codeNum) ? 400 : codeNum,
                  name: getHttpStatusName(codeNum, respDesc),
                  description: respDesc,
                  schema: errSchema,
                });
              }
            }
          }

          // Collect endpoint
          endpoints.push({
            id: endpointId,
            method: method.toUpperCase() as any,
            path: pathKey,
            summary,
            description: opDescription,
            parameters,
            requestSchema,
            responseSchema,
            responseStatusCode,
            errorResponses,
          });

          if (opDescription) {
            businessRulesList.push(`${method.toUpperCase()} ${pathKey}: ${opDescription.slice(0, 140)}`);
          }
        }
      }
    }

    const businessRules = businessRulesList.slice(0, 5).join('\n• ') ||
      '• Requests must adhere to schema validation and authorization headers.\n• Idempotent requests must return consistent status representations.\n• Rate limits and concurrency bounds apply to batch operations.';

    const validationRules = validationRulesList.slice(0, 5).join('\n• ') ||
      '• Content-Type must be application/json for non-GET operations.\n• All path parameters must be URL-encoded strings.\n• Payloads exceeding 5MB must be rejected with 413 Payload Too Large.';

    const now = new Date().toISOString();

    const spec: Partial<ApiSpec> = {
      id: `api_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      projectId,
      name: title,
      description,
      baseUrl: baseUrl || 'https://api.staging.example.com/v1',
      version,
      authType,
      authDetails,
      businessRules: businessRules.startsWith('• ') ? businessRules : `• ${businessRules}`,
      validationRules: validationRules.startsWith('• ') ? validationRules : `• ${validationRules}`,
      endpoints,
      createdAt: now,
      updatedAt: now,
      sourceType: 'openapi_paste',
      rawSpecContent: rawText,
    };

    return {
      success: true,
      spec,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse specification: ${err.message || 'Syntax error'}`,
    };
  }
}

function getHttpStatusName(code: number, defaultDesc?: string): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[code] || defaultDesc || `Error ${code}`;
}
