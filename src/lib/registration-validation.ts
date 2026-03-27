export const REGISTRATION_NAME_MIN_LENGTH = 2;
export const REGISTRATION_NAME_MAX_LENGTH = 40;
export const REGISTRATION_EMAIL_MAX_LENGTH = 120;
export const REGISTRATION_BIRTH_PLACE_MIN_LENGTH = 2;
export const REGISTRATION_BIRTH_PLACE_MAX_LENGTH = 64;
export const REGISTRATION_PHONE_MIN_LENGTH = 6;
export const REGISTRATION_PHONE_MAX_LENGTH = 14;
const MIN_BIRTH_YEAR = 1900;

const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PhoneCountryCodeOption = {
  value: string;
  label: string;
  flag: string;
};

export const PHONE_COUNTRY_CODE_OPTIONS: PhoneCountryCodeOption[] = [
  { value: "+62", label: "Indonesia (+62)", flag: "🇮🇩" },
  { value: "+60", label: "Malaysia (+60)", flag: "🇲🇾" },
  { value: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
  { value: "+66", label: "Thailand (+66)", flag: "🇹🇭" },
  { value: "+84", label: "Vietnam (+84)", flag: "🇻🇳" },
  { value: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { value: "+81", label: "Japan (+81)", flag: "🇯🇵" },
  { value: "+82", label: "Korea Selatan (+82)", flag: "🇰🇷" },
  { value: "+86", label: "China (+86)", flag: "🇨🇳" },
  { value: "+91", label: "India (+91)", flag: "🇮🇳" },
  { value: "+44", label: "United Kingdom (+44)", flag: "🇬🇧" },
  { value: "+1", label: "Amerika Serikat / Kanada (+1)", flag: "🇺🇸🇨🇦" },
];

const VALID_COUNTRY_CODE_SET = new Set(PHONE_COUNTRY_CODE_OPTIONS.map((option) => option.value));

export type RegistrationFieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthPlace?: string;
  birthDate?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
};

export type RegistrationProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthPlace?: string;
  birthDate?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
};

export type NormalizedRegistrationProfile = {
  firstName: string;
  lastName: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmailStructureValid(email: string) {
  const atIndex = email.indexOf("@");

  // Must contain exactly one "@" and at least one character before it.
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return false;
  }

  return EMAIL_PATTERN.test(email);
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D+/g, "");
}

function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (year < MIN_BIRTH_YEAR || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (parsed.getTime() > todayUtc) {
    return false;
  }

  return true;
}

export function validateRegistrationProfile(payload: RegistrationProfilePayload) {
  const normalized: NormalizedRegistrationProfile = {
    firstName: normalizeWhitespace(typeof payload.firstName === "string" ? payload.firstName : ""),
    lastName: normalizeWhitespace(typeof payload.lastName === "string" ? payload.lastName : ""),
    email: normalizeEmail(typeof payload.email === "string" ? payload.email : ""),
    birthPlace: normalizeWhitespace(typeof payload.birthPlace === "string" ? payload.birthPlace : ""),
    birthDate: typeof payload.birthDate === "string" ? payload.birthDate.trim() : "",
    phoneCountryCode:
      typeof payload.phoneCountryCode === "string" ? payload.phoneCountryCode.trim() : "",
    phoneNumber: normalizePhoneNumber(typeof payload.phoneNumber === "string" ? payload.phoneNumber : ""),
  };

  const fieldErrors: RegistrationFieldErrors = {};

  if (!normalized.firstName) {
    fieldErrors.firstName = "Nama depan wajib diisi.";
  } else if (
    normalized.firstName.length < REGISTRATION_NAME_MIN_LENGTH ||
    normalized.firstName.length > REGISTRATION_NAME_MAX_LENGTH
  ) {
    fieldErrors.firstName = `Nama depan harus ${REGISTRATION_NAME_MIN_LENGTH}-${REGISTRATION_NAME_MAX_LENGTH} karakter.`;
  } else if (!NAME_PATTERN.test(normalized.firstName)) {
    fieldErrors.firstName = "Nama depan hanya boleh huruf, spasi, apostrof, atau strip.";
  }

  if (!normalized.lastName) {
    fieldErrors.lastName = "Nama belakang wajib diisi.";
  } else if (
    normalized.lastName.length < REGISTRATION_NAME_MIN_LENGTH ||
    normalized.lastName.length > REGISTRATION_NAME_MAX_LENGTH
  ) {
    fieldErrors.lastName = `Nama belakang harus ${REGISTRATION_NAME_MIN_LENGTH}-${REGISTRATION_NAME_MAX_LENGTH} karakter.`;
  } else if (!NAME_PATTERN.test(normalized.lastName)) {
    fieldErrors.lastName = "Nama belakang hanya boleh huruf, spasi, apostrof, atau strip.";
  }

  if (!normalized.email) {
    fieldErrors.email = "Email wajib diisi.";
  } else if (normalized.email.length > REGISTRATION_EMAIL_MAX_LENGTH) {
    fieldErrors.email = `Email maksimal ${REGISTRATION_EMAIL_MAX_LENGTH} karakter.`;
  } else if (!normalized.email.includes("@")) {
    fieldErrors.email = "Email tidak valid.";
  } else if (normalized.email.split("@")[0].length < 1) {
    fieldErrors.email = "Email tidak valid.";
  } else if (!isEmailStructureValid(normalized.email)) {
    fieldErrors.email = "Email tidak valid.";
  }

  if (!normalized.birthPlace) {
    fieldErrors.birthPlace = "Tempat lahir wajib diisi.";
  } else if (
    normalized.birthPlace.length < REGISTRATION_BIRTH_PLACE_MIN_LENGTH ||
    normalized.birthPlace.length > REGISTRATION_BIRTH_PLACE_MAX_LENGTH
  ) {
    fieldErrors.birthPlace =
      `Tempat lahir harus ${REGISTRATION_BIRTH_PLACE_MIN_LENGTH}-${REGISTRATION_BIRTH_PLACE_MAX_LENGTH} karakter.`;
  }

  if (!normalized.birthDate) {
    fieldErrors.birthDate = "Tanggal lahir wajib diisi.";
  } else if (!isValidBirthDate(normalized.birthDate)) {
    fieldErrors.birthDate = "Tanggal lahir tidak valid.";
  }

  if (!normalized.phoneCountryCode) {
    fieldErrors.phoneCountryCode = "Kode negara wajib dipilih.";
  } else if (!VALID_COUNTRY_CODE_SET.has(normalized.phoneCountryCode)) {
    fieldErrors.phoneCountryCode = "Kode negara tidak valid.";
  }

  if (!normalized.phoneNumber) {
    fieldErrors.phoneNumber = "Nomor telepon wajib diisi.";
  } else if (normalized.phoneNumber.startsWith("0")) {
    fieldErrors.phoneNumber = "Nomor telepon tidak valid.";
  } else if (
    normalized.phoneNumber.length < REGISTRATION_PHONE_MIN_LENGTH ||
    normalized.phoneNumber.length > REGISTRATION_PHONE_MAX_LENGTH
  ) {
    fieldErrors.phoneNumber =
      `Nomor telepon harus ${REGISTRATION_PHONE_MIN_LENGTH}-${REGISTRATION_PHONE_MAX_LENGTH} digit.`;
  }

  return {
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
    normalized,
  };
}
