export function initializeUI() {
    function openTab(evt, tabName) {
        document.querySelectorAll(".tab-content").forEach(tc => tc.style.display = "none");
        document.querySelectorAll(".tab-link").forEach(tl => tl.classList.remove("active"));
        document.getElementById(tabName).style.display = "flex";
        evt.currentTarget.classList.add("active");
    }


    document.querySelectorAll(".tab-link").forEach(tab => {
        const activate = (evt) => openTab(evt, tab.dataset.tab);
        // Prefer hover activation on pointer-fine devices (mouse / trackpad).
        // Fallback to click on touch devices where hover isn't available.
        if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
            // tab.addEventListener('mouseenter', activate);
            tab.addEventListener('click', activate);
        } else {
            tab.addEventListener('click', activate);
        }
    });

    // Open the default active tab
    const activeTab = document.querySelector('.tab-link.active');
    if (activeTab) {
        openTab({ currentTarget: activeTab }, activeTab.dataset.tab);
    }




    // Custom Select Logic
    const customSelect = document.querySelector('.custom-select');
    const selectTrigger = customSelect.querySelector('.custom-select-trigger');
    const options = customSelect.querySelectorAll('.custom-option');

    selectTrigger.addEventListener('click', () => {
        customSelect.classList.toggle('open');
    });

    options.forEach(option => {
        option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectTrigger.querySelector('span').textContent = option.textContent;
            customSelect.classList.remove('open');
            const endConditionSelect = document.getElementById('end-condition-select');
            if(endConditionSelect) {
                endConditionSelect.value = option.dataset.value;
                endConditionSelect.dispatchEvent(new Event('change'));
            }
        });
    });

    window.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });

    // End condition input visibility logic
    const endConditionSelect = document.getElementById('end-condition-select');
    if (endConditionSelect) {
        const roundLimitSetting = document.getElementById('round-limit-setting');
        const assistantRegexSetting = document.getElementById('assistant-regex-setting');
        const userRegexSetting = document.getElementById('user-regex-setting');

        const updateEndConditionInputVisibility = () => {
            const selectedValue = endConditionSelect.value;
            roundLimitSetting.style.display = selectedValue === 'roundLimit' ? '' : 'none';
            assistantRegexSetting.style.display = selectedValue === 'assistantRegex' ? '' : 'none';
            userRegexSetting.style.display = selectedValue === 'userRegex' ? '' : 'none';
        };

        endConditionSelect.addEventListener('change', updateEndConditionInputVisibility);
        // Initial call to set the correct visibility on page load
        updateEndConditionInputVisibility();
    }


    // Toolbar slide-out logic
    const chatView = document.getElementById('chat-view');
    const toolbar = document.getElementById('left-toolbar');
    let touchStartX = 0;
    const swipeThreshold = 50; // Min distance for a swipe

    // Mouse hover logic (for non-touch devices)
    chatView.addEventListener('mousemove', (e) => {
        // Check if the primary input is not touch
        if (window.matchMedia("(pointer: fine)").matches) {
            const rect = chatView.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const triggerWidth = 30; // Match hint width

            if (mouseX < triggerWidth) {
                chatView.classList.add('toolbar-visible');
            }
        }
    });

    toolbar.addEventListener('mouseleave', () => {
        // Check if the primary input is not touch
        if (window.matchMedia("(pointer: fine)").matches) {
            chatView.classList.remove('toolbar-visible');
        }
    });

    // Touch swipe logic
    chatView.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    chatView.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const swipeDistance = touchEndX - touchStartX;

        if (swipeDistance > swipeThreshold) { // Swipe right
            chatView.classList.add('toolbar-visible');
        } else if (swipeDistance < -swipeThreshold) { // Swipe left
            chatView.classList.remove('toolbar-visible');
        }
    });

    // Trackpad swipe logic
    chatView.addEventListener('wheel', (e) => {
        // Heuristic to detect horizontal trackpad swipe
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
            e.preventDefault();
            if (e.deltaX < 0) { // Swipe right
                chatView.classList.add('toolbar-visible');
            } else { // Swipe left
                chatView.classList.remove('toolbar-visible');
            }
        }
    }, { passive: false });

    // Info panel functionality is now handled by MessageSelectionManager
}
