// Contact Form Handler
document.addEventListener('DOMContentLoaded', function() {
    // Initialize EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init("YOUR_PUBLIC_KEY"); // Replace with your actual EmailJS public key
    }
    
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitIcon = document.getElementById('submitIcon');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const messageCounter = document.getElementById('messageCounter');

    // Form validation
    function validateField(field, errorElement, validationFn) {
        const value = field.value.trim();
        const isValid = validationFn(value);
        
        if (!isValid) {
            errorElement.classList.remove('hidden');
            field.classList.add('border-red-500', 'focus:ring-red-500');
            field.classList.remove('border-gray-200', 'focus:ring-blue-500');
        } else {
            errorElement.classList.add('hidden');
            field.classList.remove('border-red-500', 'focus:ring-red-500');
            field.classList.add('border-gray-200', 'focus:ring-blue-500');
        }
        
        return isValid;
    }

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validateRequired(value) {
        return value.length > 0;
    }

    function validateMessage(value) {
        return value.length >= 10 && value.length <= 500;
    }
    
    function validatePhone(value) {
        if (!value) return true; // Optional field
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
    }
    
    function validateSubject(value) {
        return value && value.trim() !== '';
    }

    // Character counter for message
    function updateMessageCounter() {
        const message = document.getElementById('message');
        const currentLength = message.value.length;
        const maxLength = 500;
        
        messageCounter.textContent = `${currentLength}/${maxLength}`;
        
        // Change color based on length
        if (currentLength > maxLength * 0.9) {
            messageCounter.classList.add('text-red-400');
            messageCounter.classList.remove('text-white/50');
        } else if (currentLength > maxLength * 0.7) {
            messageCounter.classList.add('text-yellow-400');
            messageCounter.classList.remove('text-white/50', 'text-red-400');
        } else {
            messageCounter.classList.add('text-white/50');
            messageCounter.classList.remove('text-yellow-400', 'text-red-400');
        }
    }

    // Real-time validation
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('email');
    const organization = document.getElementById('organization');
    const phone = document.getElementById('phone');
    const subject = document.getElementById('subject');
    const message = document.getElementById('message');
    
    const firstNameError = document.getElementById('firstNameError');
    const lastNameError = document.getElementById('lastNameError');
    const emailError = document.getElementById('emailError');
    const organizationError = document.getElementById('organizationError');
    const phoneError = document.getElementById('phoneError');
    const subjectError = document.getElementById('subjectError');
    const messageError = document.getElementById('messageError');

    // Add input event listeners for real-time validation
    if (firstName) firstName.addEventListener('input', () => {
        validateField(firstName, firstNameError, validateRequired);
    });

    if (lastName) lastName.addEventListener('input', () => {
        validateField(lastName, lastNameError, validateRequired);
    });

    if (email) email.addEventListener('input', () => {
        validateField(email, emailError, validateEmail);
    });

    if (phone) phone.addEventListener('input', () => {
        validateField(phone, phoneError, validatePhone);
    });

    if (subject) subject.addEventListener('change', () => {
        validateField(subject, subjectError, validateSubject);
    });

    if (message) message.addEventListener('input', () => {
        validateField(message, messageError, validateMessage);
        updateMessageCounter();
    });

    // Initialize message counter
    if (message) updateMessageCounter();

    // Form submission
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Hide previous messages
            successMessage.classList.add('hidden');
            errorMessage.classList.add('hidden');
            
            // Validate all fields
            const isFirstNameValid = validateField(firstName, firstNameError, validateRequired);
            const isLastNameValid = validateField(lastName, lastNameError, validateRequired);
            const isEmailValid = validateField(email, emailError, validateEmail);
            const isPhoneValid = validateField(phone, phoneError, validatePhone);
            const isSubjectValid = validateField(subject, subjectError, validateSubject);
            const isMessageValid = validateField(message, messageError, validateMessage);
            
            if (!isFirstNameValid || !isLastNameValid || !isEmailValid || !isPhoneValid || !isSubjectValid || !isMessageValid) {
                // Focus on first error field
                if (!isFirstNameValid) firstName.focus();
                else if (!isLastNameValid) lastName.focus();
                else if (!isEmailValid) email.focus();
                else if (!isPhoneValid) phone.focus();
                else if (!isSubjectValid) subject.focus();
                else if (!isMessageValid) message.focus();
                return;
            }
            
            // Show loading state
            submitBtn.disabled = true;
            submitText.textContent = 'Sending...';
            submitIcon.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
            
            try {
                // Prepare form data
                const formData = {
                    firstName: firstName.value.trim(),
                    lastName: lastName.value.trim(),
                    email: email.value.trim(),
                    organization: organization.value.trim(),
                    phone: phone.value.trim(),
                    subject: subject.value,
                    message: message.value.trim(),
                    honeypot: document.getElementById('honeypot').value.trim()
                };
                
                // Determine the correct endpoint based on environment
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const endpoint = isLocalhost ? 'http://localhost:5001/your-project-id/us-central1/app/send-message' : '/send-message';
                
                console.log('Submitting to endpoint:', endpoint);
                
                // Send to server endpoint
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (result.success) {
                    // Show success message
                    successMessage.classList.remove('hidden');
                    
                    // Reset form
                    form.reset();
                    
                    // Reset field styles
                    [firstName, lastName, email, organization, phone, subject, message].forEach(field => {
                        if (field) {
                            field.classList.remove('border-red-500', 'focus:ring-red-500');
                            field.classList.add('border-gray-200', 'focus:ring-blue-500');
                        }
                    });
                    
                    // Reset message counter
                    updateMessageCounter();
                    
                    // Scroll to success message
                    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Log success for analytics
                    console.log('Contact form submitted successfully');
                    
                } else {
                    // Handle server validation errors
                    if (result.errors) {
                        Object.keys(result.errors).forEach(fieldName => {
                            const field = document.getElementById(fieldName);
                            const errorElement = document.getElementById(fieldName + 'Error');
                            if (field && errorElement) {
                                errorElement.textContent = result.errors[fieldName];
                                errorElement.classList.remove('hidden');
                                field.classList.add('border-red-500', 'focus:ring-red-500');
                                field.classList.remove('border-gray-200', 'focus:ring-blue-500');
                            }
                        });
                        
                        // Focus on first error field
                        const firstErrorField = Object.keys(result.errors)[0];
                        if (firstErrorField) {
                            document.getElementById(firstErrorField).focus();
                        }
                    } else {
                        // Show generic error message
                        errorMessage.classList.remove('hidden');
                        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            } catch (error) {
                console.error('Form submission error:', error);
                
                // Show error message
                errorMessage.classList.remove('hidden');
                errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                submitText.textContent = 'Send Message';
                submitIcon.classList.remove('hidden');
                loadingSpinner.classList.add('hidden');
            }
        });
    }

    // Clear error messages when user starts typing
    function clearErrorOnInput(field, errorElement) {
        if (field && errorElement) {
            field.addEventListener('input', () => {
                if (errorElement.classList.contains('hidden') === false) {
                    errorElement.classList.add('hidden');
                    field.classList.remove('border-red-500', 'focus:ring-red-500');
                    field.classList.add('border-gray-200', 'focus:ring-blue-500');
                }
            });
        }
    }

    // Add focus effects for better UX
    function addFocusEffects() {
        const inputs = [firstName, lastName, email, organization, phone, subject, message];
        
        inputs.forEach(input => {
            if (input) {
                input.addEventListener('focus', () => {
                    input.classList.add('ring-2', 'ring-blue-500/20');
                });
                
                input.addEventListener('blur', () => {
                    input.classList.remove('ring-2', 'ring-blue-500/20');
                });
            }
        });
    }

    // Initialize focus effects
    addFocusEffects();

    // Initialize error clearing
    clearErrorOnInput(firstName, firstNameError);
    clearErrorOnInput(lastName, lastNameError);
    clearErrorOnInput(email, emailError);
    clearErrorOnInput(organization, organizationError);
    clearErrorOnInput(phone, phoneError);
    clearErrorOnInput(subject, subjectError);
    clearErrorOnInput(message, messageError);
}); 