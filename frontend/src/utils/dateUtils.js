/**
 * Date & Timezone Utilities
 * 
 * Ensures that all date operations dynamically respect the client device's native local timezone
 * and Indian business formatting (DD-MM-YYYY / YYYY-MM-DD).
 * Eliminates UTC off-by-one conversion bugs caused by hardcoded .toISOString().split('T')[0].
 */

/**
 * Returns the client device's currently configured IANA timezone dynamically.
 * e.g. "Asia/Kolkata", "UTC", etc. Never hardcoded.
 */
export const getDeviceTimeZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch {
        return 'Asia/Kolkata';
    }
};

/**
 * Formats a Date object (or date string) into a local "YYYY-MM-DD" string
 * using the device's native local calendar date (not UTC).
 * 
 * @param {Date|string|number} date 
 * @returns {string} "YYYY-MM-DD"
 */
export const formatLocalDate = (date = new Date()) => {
    if (!date) return '';
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Formats any date input into Indian standard display format "DD-MM-YYYY".
 * 
 * @param {Date|string|number} dateInput 
 * @returns {string} "DD-MM-YYYY"
 */
export const formatDisplayDate = (dateInput) => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [yyyy, mm, dd] = dateInput.split('-');
        return `${dd}-${mm}-${yyyy}`;
    }
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

/**
 * Parses a "YYYY-MM-DD" string into a local midnight Date object,
 * avoiding the UTC midnight parsing shift inherent to new Date("YYYY-MM-DD").
 * 
 * @param {string|Date} dateStr 
 * @returns {Date}
 */
export const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
};
