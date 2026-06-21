(function() {
    'use strict';
    if (window.innerWidth > 576) return;

    var EXEMPT_PAGE = 'inspectionPage';
    var MODULE_PAGES = [
        'personnelPage', 'trainingPage', 'teamPage', 'teamPersonnelPage',
        'honorPage', 'patrolPage', 'samplingCarPage', 'instrumentPage',
        'taskPage', 'hazardPage', 'samplingAnomalyPage'
    ];

    var HIDE_ID_PATTERNS = [
        /^add/i, /import/i, /^export/i, /ToCloud/i, /batchDelete/i,
        /Save.*Btn/i, /Edit.*Btn/i, /Delete.*Btn/i, /Clear$/i, /ClearBtn/i,
        /confirm/i, /cancelAdd/i, /cancelEdit/i, /selectAll/i,
        /deleteSelected/i, /exportSelected/i, /batchImport/i, /batchExport/i
    ];

    var HIDE_CLASSES = [
        '.btn-edit', '.btn-delete', '.btn-status', '.btn-add-row',
        '.btn-import', '.btn-export-delete', '.btn-delete-selected',
        '.btn-export-selected', '.btn-batch-delete'
    ];

    var HIDE_TEXT = /添加|新增|导入|导出|编辑|删除|保存到云端|清空|批量|撤销|修改|上传|保存$/;

    var HIDE_KEEP_TEXT = /刷新|搜索|筛选|关闭|取消|返回|查看|上一页|下一页/;

    var debounceTimer = null;

    function isHiddenId(id) {
        if (!id) return false;
        for (var i = 0; i < HIDE_ID_PATTERNS.length; i++) {
            if (HIDE_ID_PATTERNS[i].test(id)) return true;
        }
        return false;
    }

    function hideModuleActions(page) {
        if (!page || page.id === EXEMPT_PAGE) return;

        var all = page.querySelectorAll('[id]');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (isHiddenId(el.id) && el.style.display !== 'none') {
                el.style.display = 'none';
            }
        }

        for (var j = 0; j < HIDE_CLASSES.length; j++) {
            var items = page.querySelectorAll(HIDE_CLASSES[j]);
            for (var k = 0; k < items.length; k++) {
                items[k].style.display = 'none';
            }
        }

        var toolbarBtns = page.querySelectorAll('.page-header .btn, .toolbar-left .btn, .toolbar-right .btn, .toolbar .btn');
        for (var l = 0; l < toolbarBtns.length; l++) {
            var btn = toolbarBtns[l];
            if (btn.style.display === 'none') continue;
            var text = btn.textContent.trim();
            if (HIDE_TEXT.test(text) && !HIDE_KEEP_TEXT.test(text)) {
                btn.style.display = 'none';
            }
        }
    }

    function applyReadonlyMode() {
        for (var i = 0; i < MODULE_PAGES.length; i++) {
            hideModuleActions(document.getElementById(MODULE_PAGES[i]));
        }
    }

    function debouncedApply() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyReadonlyMode, 100);
    }

    function setupObserver() {
        var target = document.getElementById('app') || document.body;
        try {
            var observer = new MutationObserver(debouncedApply);
            observer.observe(target, { childList: true, subtree: true });
        } catch (e) {
            console.warn('[只读模式] MutationObserver 不可用');
        }
    }

    function init() {
        applyReadonlyMode();
        setupObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 200);
        });
    } else {
        setTimeout(init, 200);
    }
})();
