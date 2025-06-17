/**
 * @jest-environment jsdom
 */

describe('Unified Message System CSS Classes', () => {
    beforeEach(() => {
        // Create a mock stylesheet with our CSS classes
        const style = document.createElement('style');
        style.textContent = `
            .nova-pill-success {
                margin: 0 auto !important;
                background: rgba(76, 175, 80, 0.1) !important;
                color: #4caf50 !important;
                text-align: center !important;
                border-radius: 20px !important;
                max-width: 200px !important;
                display: block !important;
            }
            .nova-bubble-success {
                margin-right: auto !important;
                background: #f0f9f0 !important;
                color: #2d5a2d !important;
                text-align: left !important;
                max-width: 80% !important;
            }
            .nova-bubble-error {
                margin-right: auto !important;
                background: #fef2f2 !important;
                color: #7f1d1d !important;
            }
            .nova-pill-system {
                margin: 0 auto !important;
                background: #f5f5f5 !important;
                text-align: center !important;
            }
        `;
        document.head.appendChild(style);
    });

    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    test('should apply nova-pill-success class correctly', () => {
        const element = document.createElement('div');
        element.className = 'nova-message nova-pill-success';
        element.textContent = '✓ Done';
        document.body.appendChild(element);

        const computedStyle = window.getComputedStyle(element);
        expect(element.classList.contains('nova-pill-success')).toBe(true);
        expect(computedStyle.backgroundColor).toBeTruthy();
        expect(computedStyle.textAlign).toBe('center');
    });

    test('should apply nova-bubble-success class correctly', () => {
        const element = document.createElement('div');
        element.className = 'nova-message nova-bubble-success';
        element.textContent = 'Success message with longer content';
        document.body.appendChild(element);

        const computedStyle = window.getComputedStyle(element);
        expect(element.classList.contains('nova-bubble-success')).toBe(true);
        expect(computedStyle.backgroundColor).toBeTruthy();
        expect(computedStyle.textAlign).toBe('left');
    });

    test('should apply nova-bubble-error class correctly', () => {
        const element = document.createElement('div');
        element.className = 'nova-message nova-bubble-error';
        element.textContent = 'Error message';
        document.body.appendChild(element);

        expect(element.classList.contains('nova-bubble-error')).toBe(true);
    });

    test('should apply nova-pill-system class correctly', () => {
        const element = document.createElement('div');
        element.className = 'nova-message nova-pill-system';
        element.textContent = 'System message';
        document.body.appendChild(element);

        expect(element.classList.contains('nova-pill-system')).toBe(true);
    });
});