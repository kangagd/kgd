import { createClient } from '@base44/sdk';

// Global 429 circuit breaker
let rateLimitBackoff = 0;
let rateLimitResetTime = 0;

const checkRateLimit = () => {
  const now = Date.now();
  if (now < rateLimitResetTime) {
    const waitMs = rateLimitResetTime - now;
    throw new Error(`Rate limit active. Please wait ${Math.ceil(waitMs / 1000)}s`);
  }
  rateLimitBackoff = 0;
};

const handleRateLimitError = (error) => {
  if (error?.response?.status === 429) {
    rateLimitBackoff = Math.min(rateLimitBackoff + 1, 5);
    const backoffMs = rateLimitBackoff * 2000; // 2s, 4s, 6s, 8s, 10s
    rateLimitResetTime = Date.now() + backoffMs;
    console.warn(`[429 Circuit Breaker] Activated for ${backoffMs}ms`);
  }
};

// Create base44 client with circuit breaker interceptor
export const base44 = createClient();

// Intercept all SDK calls to check rate limit
const originalInvoke = base44.functions.invoke;
base44.functions.invoke = async (...args) => {
  checkRateLimit();
  try {
    return await originalInvoke.apply(base44.functions, args);
  } catch (error) {
    handleRateLimitError(error);
    throw error;
  }
};

// Intercept entity operations
const wrapEntityMethod = (entityProxy, method) => {
  const original = entityProxy[method];
  return async (...args) => {
    checkRateLimit();
    try {
      return await original.apply(entityProxy, args);
    } catch (error) {
      handleRateLimitError(error);
      throw error;
    }
  };
};

// Wrap entity methods dynamically
const entityHandler = {
  get(target, entityName) {
    const entity = target[entityName];
    if (!entity) return entity;
    
    return new Proxy(entity, {
      get(entityTarget, methodName) {
        const method = entityTarget[methodName];
        if (typeof method !== 'function') return method;
        
        const asyncMethods = ['list', 'filter', 'get', 'create', 'update', 'delete', 'bulkCreate'];
        if (asyncMethods.includes(methodName)) {
          return wrapEntityMethod(entityTarget, methodName);
        }
        
        return method;
      }
    });
  }
};

base44.entities = new Proxy(base44.entities, entityHandler);