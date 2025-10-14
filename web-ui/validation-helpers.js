/**
 * Validation Helpers
 * 
 * Centralized input validation for API endpoints
 */

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

/**
 * Validate required fields
 */
function validateRequired(obj, fields) {
  const missing = [];
  
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      missing[0]
    );
  }
}

/**
 * Validate string field
 */
function validateString(value, fieldName, options = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }
  
  if (options.minLength && value.length < options.minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.minLength} characters`,
      fieldName
    );
  }
  
  if (options.maxLength && value.length > options.maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.maxLength} characters`,
      fieldName
    );
  }
  
  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(
      `${fieldName} format is invalid`,
      fieldName
    );
  }
  
  return value.trim();
}

/**
 * Validate number field
 */
function validateNumber(value, fieldName, options = {}) {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName);
  }
  
  if (options.min !== undefined && num < options.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.min}`,
      fieldName
    );
  }
  
  if (options.max !== undefined && num > options.max) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.max}`,
      fieldName
    );
  }
  
  if (options.integer && !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be an integer`, fieldName);
  }
  
  return num;
}

/**
 * Validate email format
 */
function validateEmail(email, fieldName = 'email') {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', fieldName);
  }
  
  return email.toLowerCase().trim();
}

/**
 * Validate enum (one of allowed values)
 */
function validateEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      fieldName
    );
  }
  
  return value;
}

/**
 * Validate pagination parameters
 */
function validatePagination(query) {
  const page = query.page ? validateNumber(query.page, 'page', { min: 1, integer: true }) : 1;
  const limit = query.limit ? validateNumber(query.limit, 'limit', { min: 1, max: 100, integer: true }) : 50;
  
  return { page, limit };
}

/**
 * Sanitize string (remove dangerous characters)
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Express middleware for validation errors
 */
function validationErrorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      field: err.field
    });
  }
  
  next(err);
}

module.exports = {
  ValidationError,
  validateRequired,
  validateString,
  validateNumber,
  validateEmail,
  validateEnum,
  validatePagination,
  sanitizeString,
  validationErrorHandler
};
