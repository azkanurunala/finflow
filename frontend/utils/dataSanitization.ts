/**
 * Data Sanitization Utilities for Social Auth Profile Fix
 * Requirements: 5.4, 5.5
 * 
 * This module provides utilities for sanitizing malformed profile data,
 * validating required fields, and logging errors with privacy protection.
 */

import { UserProfile, OAuthProviderType, ProfileValidationError } from '../types/auth';

/**
 * Configuration for data sanitization
 */
interface SanitizationConfig {
  maxStringLength: number;
  allowedEmailDomains?: string[]; // Optional whitelist of email domains
  strictMode: boolean; // Whether to apply strict validation rules
}

const DEFAULT_SANITIZATION_CONFIG: SanitizationConfig = {
  maxStringLength: 255,
  allowedEmailDomains: undefined, // No domain restrictions by default
  strictMode: false,
};

/**
 * Validation result for profile data
 */
interface ValidationResult {
  isValid: boolean;
  errors: ProfileValidationError[];
  warnings: string[];
}

/**
 * Sanitized profile data result
 */
interface SanitizationResult {
  sanitizedProfile: Partial<UserProfile>;
  wasModified: boolean;
  modifications: string[];
}

/**
 * Privacy-safe error information for logging
 */
interface SafeErrorInfo {
  errorType: string;
  errorCode: string;
  timestamp: Date;
  context: string;
  sanitizedMessage: string;
}

/**
 * Data Sanitization Utilities Class
 */
export class DataSanitizationUtils {
  private config: SanitizationConfig;

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = { ...DEFAULT_SANITIZATION_CONFIG, ...config };
  }

  /**
   * Sanitizes profile data by cleaning malformed or potentially dangerous content
   * Requirements: 5.4
   * 
   * @param profileData - Raw profile data that may contain malformed content
   * @returns Sanitized profile data with modification details
   */
  sanitizeProfileData(profileData: Partial<UserProfile>): SanitizationResult {
    const sanitizedProfile: Partial<UserProfile> = {};
    const modifications: string[] = [];
    let wasModified = false;

    // Sanitize string fields
    const stringFields: (keyof UserProfile)[] = [
      'id', 'displayName', 'email', 'providerId', 'avatarUrl', 'firstName', 'lastName'
    ];

    for (const field of stringFields) {
      const value = profileData[field];
      if (value !== undefined && value !== null) {
        const sanitizedValue = this.sanitizeString(value as string, field);
        if (sanitizedValue !== value) {
          modifications.push(`${field}: cleaned malformed content`);
          wasModified = true;
        }
        if (sanitizedValue !== null && sanitizedValue !== undefined) {
          (sanitizedProfile as any)[field] = sanitizedValue;
        }
      }
    }

    // Sanitize provider type
    if (profileData.providerType !== undefined) {
      const sanitizedProviderType = this.sanitizeProviderType(profileData.providerType);
      if (sanitizedProviderType !== profileData.providerType) {
        modifications.push('providerType: normalized to valid value');
        wasModified = true;
      }
      if (sanitizedProviderType) {
        sanitizedProfile.providerType = sanitizedProviderType;
      }
    }

    // Sanitize dates
    if (profileData.createdAt !== undefined) {
      const sanitizedCreatedAt = this.sanitizeDate(profileData.createdAt, 'createdAt');
      if (sanitizedCreatedAt !== profileData.createdAt) {
        modifications.push('createdAt: fixed invalid date');
        wasModified = true;
      }
      if (sanitizedCreatedAt) {
        sanitizedProfile.createdAt = sanitizedCreatedAt;
      }
    }

    if (profileData.updatedAt !== undefined) {
      const sanitizedUpdatedAt = this.sanitizeDate(profileData.updatedAt, 'updatedAt');
      if (sanitizedUpdatedAt !== profileData.updatedAt) {
        modifications.push('updatedAt: fixed invalid date');
        wasModified = true;
      }
      if (sanitizedUpdatedAt) {
        sanitizedProfile.updatedAt = sanitizedUpdatedAt;
      }
    }

    return {
      sanitizedProfile,
      wasModified,
      modifications,
    };
  }

  /**
   * Validates that all required fields are present and valid
   * Requirements: 5.4
   * 
   * @param profile - Profile data to validate
   * @returns Validation result with errors and warnings
   */
  validateRequiredFields(profile: Partial<UserProfile>): ValidationResult {
    const errors: ProfileValidationError[] = [];
    const warnings: string[] = [];

    // Required fields validation
    const requiredFields = ['id', 'email', 'displayName', 'providerId', 'providerType'];
    
    for (const field of requiredFields) {
      const value = profile[field as keyof UserProfile];
      
      if (value === undefined || value === null) {
        errors.push(this.createValidationError(
          'MISSING_REQUIRED_FIELD',
          `Required field '${field}' is missing`,
          field,
          value
        ));
      } else if (typeof value === 'string' && value.trim() === '') {
        errors.push(this.createValidationError(
          'EMPTY_REQUIRED_FIELD',
          `Required field '${field}' is empty`,
          field,
          value
        ));
      }
    }

    // Specific field validations
    if (profile.email) {
      if (!this.isValidEmail(profile.email)) {
        errors.push(this.createValidationError(
          'INVALID_EMAIL_FORMAT',
          'Email format is invalid',
          'email',
          profile.email
        ));
      } else if (this.config.allowedEmailDomains) {
        const domain = this.extractEmailDomain(profile.email);
        if (domain && !this.config.allowedEmailDomains.includes(domain)) {
          if (this.config.strictMode) {
            errors.push(this.createValidationError(
              'DISALLOWED_EMAIL_DOMAIN',
              'Email domain is not in allowed list',
              'email',
              profile.email
            ));
          } else {
            warnings.push(`Email domain '${domain}' is not in allowed list`);
          }
        }
      }
    }

    if (profile.providerType && !['google', 'apple'].includes(profile.providerType)) {
      errors.push(this.createValidationError(
        'INVALID_PROVIDER_TYPE',
        'Provider type must be either "google" or "apple"',
        'providerType',
        profile.providerType
      ));
    }

    if (profile.createdAt && (!(profile.createdAt instanceof Date) || isNaN(profile.createdAt.getTime()))) {
      errors.push(this.createValidationError(
        'INVALID_CREATED_DATE',
        'Created date must be a valid Date object',
        'createdAt',
        profile.createdAt
      ));
    }

    if (profile.updatedAt && (!(profile.updatedAt instanceof Date) || isNaN(profile.updatedAt.getTime()))) {
      errors.push(this.createValidationError(
        'INVALID_UPDATED_DATE',
        'Updated date must be a valid Date object',
        'updatedAt',
        profile.updatedAt
      ));
    }

    // Optional field warnings
    if (!profile.firstName && !profile.lastName && profile.providerType === 'apple') {
      warnings.push('Apple profile missing both first and last name - may indicate incomplete OAuth response');
    }

    if (!profile.avatarUrl && profile.providerType === 'google') {
      warnings.push('Google profile missing avatar URL - user may not have profile picture');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Creates privacy-protected error logs for debugging
   * Requirements: 5.5
   * 
   * @param error - The error to log
   * @param context - Context information about where the error occurred
   * @param additionalData - Additional non-sensitive data to include
   * @returns Safe error information for logging
   */
  createPrivacySafeErrorLog(
    error: Error | any,
    context: string,
    additionalData?: Record<string, any>
  ): SafeErrorInfo {
    const timestamp = new Date();
    
    // Determine error type and code
    let errorType = 'UnknownError';
    let errorCode = 'UNKNOWN';
    let sanitizedMessage = 'An error occurred';

    if (error instanceof Error) {
      errorType = error.constructor.name;
      sanitizedMessage = this.sanitizeErrorMessage(error.message);
      
      // Extract error codes from common patterns
      if (error.message.includes('MISSING_REQUIRED_FIELD')) {
        errorCode = 'MISSING_REQUIRED_FIELD';
      } else if (error.message.includes('INVALID_EMAIL')) {
        errorCode = 'INVALID_EMAIL';
      } else if (error.message.includes('NETWORK')) {
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('TIMEOUT')) {
        errorCode = 'TIMEOUT_ERROR';
      } else if (error.message.includes('OAUTH')) {
        errorCode = 'OAUTH_ERROR';
      } else {
        errorCode = 'GENERAL_ERROR';
      }
    } else if (typeof error === 'object' && error !== null) {
      if (error.code) {
        errorCode = String(error.code);
      }
      if (error.message) {
        sanitizedMessage = this.sanitizeErrorMessage(String(error.message));
      }
      if (error.name) {
        errorType = String(error.name);
      }
    }

    // Create safe error info
    const safeErrorInfo: SafeErrorInfo = {
      errorType,
      errorCode,
      timestamp,
      context: this.sanitizeString(context, 'context') || 'unknown',
      sanitizedMessage,
    };

    // Add sanitized additional data if provided
    if (additionalData) {
      const sanitizedAdditionalData = this.sanitizeAdditionalData(additionalData);
      (safeErrorInfo as any).additionalData = sanitizedAdditionalData;
    }

    return safeErrorInfo;
  }

  /**
   * Logs error with privacy protection
   * Requirements: 5.5
   * 
   * @param error - The error to log
   * @param context - Context information
   * @param additionalData - Additional non-sensitive data
   */
  logErrorWithPrivacyProtection(
    error: Error | any,
    context: string,
    additionalData?: Record<string, any>
  ): void {
    const safeErrorInfo = this.createPrivacySafeErrorLog(error, context, additionalData);
    
    // Use console.error for now, but this could be replaced with a proper logging service
    console.error('[DataSanitization] Privacy-safe error log:', {
      timestamp: safeErrorInfo.timestamp.toISOString(),
      context: safeErrorInfo.context,
      errorType: safeErrorInfo.errorType,
      errorCode: safeErrorInfo.errorCode,
      message: safeErrorInfo.sanitizedMessage,
      ...(safeErrorInfo as any).additionalData && { additionalData: (safeErrorInfo as any).additionalData },
    });
  }

  /**
   * Private helper methods
   */

  /**
   * Sanitizes string values by removing potentially dangerous content
   */
  private sanitizeString(value: any, fieldName: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    // Convert to string if not already
    let str = String(value);

    // Remove null bytes and control characters (except newlines and tabs for display names)
    if (fieldName === 'displayName' || fieldName === 'firstName' || fieldName === 'lastName') {
      str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else {
      str = str.replace(/[\x00-\x1F\x7F]/g, '');
    }

    // Remove potential XSS patterns
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    str = str.replace(/javascript:/gi, '');
    str = str.replace(/on\w+\s*=/gi, '');

    // Trim whitespace
    str = str.trim();

    // Enforce maximum length
    if (str.length > this.config.maxStringLength) {
      str = str.substring(0, this.config.maxStringLength).trim();
    }

    // Return null if string becomes empty after sanitization
    return str === '' ? null : str;
  }

  /**
   * Sanitizes provider type to ensure it's valid
   */
  private sanitizeProviderType(value: any): OAuthProviderType | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.toLowerCase().trim();
    if (normalized === 'google' || normalized === 'apple') {
      return normalized as OAuthProviderType;
    }

    return null;
  }

  /**
   * Sanitizes date values
   */
  private sanitizeDate(value: any, fieldName: string): Date | null {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return null;
      }
      
      // Validate reasonable date ranges
      const now = new Date();
      const minDate = new Date('2000-01-01'); // Reasonable minimum date
      const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Allow up to 1 day in future

      if (value < minDate || value > maxDate) {
        return null;
      }
      
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return null;
      }

      // Validate reasonable date ranges
      const now = new Date();
      const minDate = new Date('2000-01-01'); // Reasonable minimum date
      const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Allow up to 1 day in future

      if (date < minDate || date > maxDate) {
        return null;
      }

      return date;
    }

    return null;
  }

  /**
   * Creates a validation error object
   */
  private createValidationError(
    code: string,
    message: string,
    field: string,
    value: any
  ): ProfileValidationError {
    return {
      code,
      message,
      field,
      value: this.sanitizeValueForError(value),
      details: undefined,
    };
  }

  /**
   * Sanitizes error messages to remove sensitive information
   */
  private sanitizeErrorMessage(message: string): string {
    let sanitized = message;

    // Remove email addresses
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    
    // Remove potential tokens or IDs (long alphanumeric strings)
    sanitized = sanitized.replace(/\b[A-Za-z0-9]{15,}\b/g, '[TOKEN]');
    
    // Remove URLs
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    
    // Remove file paths
    sanitized = sanitized.replace(/[A-Za-z]:\\[^\s]+/g, '[PATH]');
    sanitized = sanitized.replace(/\/[^\s]+/g, '[PATH]');

    return sanitized;
  }

  /**
   * Sanitizes additional data for error logging
   */
  private sanitizeAdditionalData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive keys
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, key);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize objects (with depth limit)
        sanitized[key] = this.sanitizeObjectForLogging(value, 0); // Start at depth 0
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Checks if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /email/i,
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /private/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  /**
   * Sanitizes objects for logging with depth limit
   */
  private sanitizeObjectForLogging(obj: any, depth: number): any {
    if (depth > 2) { // Limit recursion depth
      return '[OBJECT_TOO_DEEP]';
    }

    if (Array.isArray(obj)) {
      return obj.slice(0, 10).map(item => // Limit array size
        typeof item === 'object' && item !== null ? this.sanitizeObjectForLogging(item, depth + 1) : item
      );
    }

    const sanitized: any = {};
    let keyCount = 0;
    
    for (const [key, value] of Object.entries(obj)) {
      if (keyCount >= 20) { // Limit number of keys
        sanitized['...'] = '[TRUNCATED]';
        break;
      }

      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObjectForLogging(value, depth + 1);
      } else {
        sanitized[key] = value;
      }
      
      keyCount++;
    }

    return sanitized;
  }

  /**
   * Sanitizes values for inclusion in error objects
   */
  private sanitizeValueForError(value: any): any {
    if (typeof value === 'string') {
      // For error reporting, we want to show the type of issue without exposing sensitive data
      if (this.isValidEmail(value)) {
        return '[EMAIL_ADDRESS]';
      }
      if (value.length > 50) {
        return `[LONG_STRING_${value.length}_CHARS]`;
      }
      return this.sanitizeString(value, 'error_value');
    }
    
    if (typeof value === 'object' && value !== null) {
      return '[OBJECT]';
    }
    
    return value;
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Extracts domain from email address
   */
  private extractEmailDomain(email: string): string | null {
    if (!this.isValidEmail(email)) {
      return null;
    }
    
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) {
      return null;
    }
    
    return email.substring(atIndex + 1).toLowerCase().trim();
  }
}

// Export singleton instance with default configuration
export const dataSanitizationUtils = new DataSanitizationUtils();

// Export types for external use
export type {
  SanitizationConfig,
  ValidationResult,
  SanitizationResult,
  SafeErrorInfo,
};