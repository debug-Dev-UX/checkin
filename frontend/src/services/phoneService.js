/**
 * Phone Number Parsing & Sanitization Service
 * Prevents multiple concatenated country codes (e.g. "+855 +855 +855 123456")
 */

export const KNOWN_COUNTRY_CODES = ['+855', '+1', '+44', '+66', '+84', '+65', '+91']

/**
 * Extracts country code and pure local phone number digits.
 * Automatically cleans corrupted strings with repeated country codes.
 */
export function parsePhoneAndCountry(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return { code: '+855', number: '' }
  let str = rawPhone.trim()

  let detectedCode = '+855'

  // Recursively strip repeated country codes
  let stripped = true
  while (stripped) {
    stripped = false
    str = str.trim()
    for (const code of KNOWN_COUNTRY_CODES) {
      if (str.startsWith(code)) {
        detectedCode = code
        str = str.slice(code.length).trim()
        stripped = true
        break
      }
    }
  }

  // Remove any leading '+' or extra spaces
  str = str.replace(/^\++/, '').trim()
  return { code: detectedCode, number: str }
}

/**
 * Formats a clean phone string combining country code and local number
 */
export function formatCleanPhone(countryCode = '+855', phone = '') {
  const parsed = parsePhoneAndCountry(phone)
  const code = countryCode || parsed.code || '+855'
  const cleanNumber = parsed.number.trim()
  return cleanNumber ? `${code} ${cleanNumber}` : ''
}
