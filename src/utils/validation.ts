export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function isValidPhoneNumber(phone: string): boolean {
  const cleanPhone = phone.trim().replace(/[\s-]/g, "");
  const phoneRegex = /^\+?[0-9]{10,13}$/;
  return phoneRegex.test(cleanPhone);
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { isValid: false, error: "Email is required." };
  }
  if (!isValidEmail(email)) {
    return { isValid: false, error: "Please enter a valid email address." };
  }
  return { isValid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: "Password is required." };
  }
  if (password.length < 6) {
    return {
      isValid: false,
      error: "Password must be at least 6 characters long.",
    };
  }
  return { isValid: true };
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string,
): ValidationResult {
  if (!confirmPassword) {
    return { isValid: false, error: "Please confirm your password." };
  }
  if (password !== confirmPassword) {
    return { isValid: false, error: "Passwords do not match." };
  }
  return { isValid: true };
}

export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: "Phone number is required." };
  }
  if (!isValidPhoneNumber(phone)) {
    return {
      isValid: false,
      error: "Please enter a valid phone number (10-13 digits).",
    };
  }
  return { isValid: true };
}

export function validateUsername(username: string): ValidationResult {
  if (!username || !username.trim()) {
    return { isValid: false, error: "Username is required." };
  }
  if (username.trim().length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters." };
  }
  if (/\s/.test(username.trim())) {
    return { isValid: false, error: "Username cannot contain spaces." };
  }
  return { isValid: true };
}

export function validateName(name: string, fieldName: string = "Name"): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  if (name.trim().length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters.` };
  }
  return { isValid: true };
}

export function validateGender(gender: string): ValidationResult {
  if (!gender || !gender.trim()) {
    return { isValid: false, error: "Please select your gender." };
  }
  return { isValid: true };
}

