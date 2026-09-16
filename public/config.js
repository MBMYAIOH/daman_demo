// Configuration file for the Daman Claims Document Processor (UAE)

// Works out where the /upload and /resume proxy endpoints live.
//
//   deployed (Render, or any host running cors-proxy.js)
//       -> same origin as this page, so relative paths are correct
//   opened straight off disk as file://
//       -> fall back to a locally running proxy
//
// Set CORS_PROXY_BASE_URL below to an absolute URL only when the proxy is on a
// different host than the page (for example a static Vercel build talking to a
// proxy deployed on Render).
function resolveProxyBaseUrl() {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') {
        return 'http://localhost:3002';
    }
    return ''; // same origin
}

const CONFIG = {
    // ---------------------------------------------------------------
    // Integration endpoints
    // ---------------------------------------------------------------

    // Webhook URL for document processing.
    //
    // Left empty on purpose. In proxy mode (the default, and what Render runs) the
    // server decides the destination from N8N_WEBHOOK_URL and this value is unused.
    // It is only needed if you set USE_CORS_PROXY to false so the browser calls n8n
    // directly - and note that anything you put here ships in page source for anyone
    // to read, so only use a webhook you are happy to have public.
    WEBHOOK_URL: '',

    // CORS Proxy settings
    USE_CORS_PROXY: true,
    CORS_PROXY_BASE_URL: resolveProxyBaseUrl(),

    // ---------------------------------------------------------------
    // Upload rules
    // ---------------------------------------------------------------

    // File upload limits
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB in bytes
    MAX_FILES: 5,

    // Required fields validation
    REQUIRED_FIELDS: ['claimed_amount'],
    EITHER_OR_FIELDS: [],

    // ---------------------------------------------------------------
    // Branding — swap these to re-skin the interface
    // ---------------------------------------------------------------
    BRAND: {
        NAME: 'Daman',
        LEGAL_NAME: 'National Health Insurance Company – Daman',
        LOGO: 'logo.svg',
        APP_TITLE: 'Claims Document Processing',
        APP_SUBTITLE: 'Upload member claim documents for automated extraction and adjudication',
        LOCALE: 'en-AE',
        CURRENCY: 'AED'
    },

    // ---------------------------------------------------------------
    // UAE / Daman domain configuration
    // ---------------------------------------------------------------

    // Fields captured by OCR that the reviewer must not overwrite
    NON_EDITABLE_FIELDS: [
        'gender',
        'country',
        'emirates_id',
        'card_number',
        'member_card_number',
        'policy_number',
        'diagnosis',
        'provider',
        'provider_license',
        'physician_name',
        'physician_license',
        'receipt_number',
        'invoice_number',
        'physician_signature',
        'physician_stamp',
        'documents_attached',
        'docs_attached'
    ],

    // Human-readable labels for UAE / Daman specific field names
    FIELD_LABELS: {
        emirates_id: 'Emirates ID',
        member_card_number: 'Daman Card Number',
        card_number: 'Daman Card Number',
        member_name: 'Member Name',
        policy_number: 'Policy Number',
        plan: 'Daman Plan',
        network: 'Provider Network',
        payer: 'Payer',
        provider: 'Provider',
        provider_license: 'Provider Licence (DOH/DHA/MOH)',
        physician_name: 'Physician Name',
        physician_license: 'Physician Licence',
        claimed_amount: 'Claimed Amount',
        claimed_amount_aed: 'Claimed Amount (AED)',
        invoice_number: 'Invoice Number',
        receipt_number: 'Receipt Number',
        date_of_treatment: 'Date of Treatment',
        claim_type: 'Claim Type',
        emirate: 'Emirate',
        tpa: 'TPA',
        country: 'Country of Treatment',
        diagnosis: 'Diagnosis',
        treatment: 'Treatment',
        docs_attached: 'Documents Attached',
        documents_attached: 'Documents Attached',
        physician_signature: 'Physician Signature',
        physician_stamp: 'Physician Stamp',
        age: 'Age',
        gender: 'Gender'
    },

    // Monetary fields that must reach the workflow as real numbers.
    //
    // The workflow multiplies these by an exchange rate for currency conversion.
    // JavaScript coerces a plain numeric string fine ("800.00" * 3.67 works), but
    // anything with a thousands separator or a currency prefix does not:
    // "1,250.00" * 3.67 and "AED 800" * 3.67 both produce NaN. OCR returns these
    // as strings, and the reviewer editing a field always produces a string, so
    // they are normalised to numbers before being sent back.
    NUMERIC_FIELDS: [
        'claimed_amount',
        'covered_amount',
        'benefit_limit',
        'excess_amount',
        'deductible',
        'copay_cap',
        'copay_amount',
        'copay_percentage',
        'patient_responsibility',
        'reimbursement_amount',
        'conversion_rate'
    ],

    // Daman product plans, used for display normalisation
    PLANS: ['Thiqa', 'Enhanced', 'Basic', 'Abu Dhabi Basic', 'Care', 'Premier'],

    // Maps an extracted claim_type onto a Daman benefit category
    CLAIM_TYPE_TO_BENEFIT: {
        CONSULTATION: 'Outpatient',
        LABORATORY: 'Outpatient',
        MEDICAL: 'Outpatient',
        PHARMACY: 'Pharmacy',
        RADIOLOGY: 'Outpatient',
        PHYSIOTHERAPY: 'Physiotherapy',
        OPTICAL: 'Optical',
        DENTAL: 'Dental',
        MATERNITY: 'Maternity',
        DISCHARGE_SUMMARY: 'Inpatient',
        HOSPITAL_FINAL_BILL: 'Inpatient',
        ALTERNATIVE_MEDICINE: 'Alternative Medicine',
        HEALTH_CHECKUP: 'Preventive & Wellness',
        VACCINATION: 'Preventive & Wellness',
        REPATRIATION: 'Additional Benefits',
        EMERGENCY: 'Emergency'
    }
};

// Computed values based on configuration
CONFIG.CORS_PROXY_UPLOAD_URL = `${CONFIG.CORS_PROXY_BASE_URL}/upload`;
CONFIG.CORS_PROXY_RESUME_URL = `${CONFIG.CORS_PROXY_BASE_URL}/resume`;
CONFIG.CORS_PROXY_CODING_URL = `${CONFIG.CORS_PROXY_BASE_URL}/coding`;
