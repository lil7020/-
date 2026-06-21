// ============================================
// 采样点异常模块隐藏功能验证脚本
// ============================================
// 使用方法：在浏览器控制台执行此脚本
// ============================================

console.log(' 开始验证采样点异常模块隐藏功能...\n');

// 1. 检查模块初始化标志
console.log('✅ 检查 1: 模块初始化标志');
if (typeof samplingAnomalyModuleInitialized !== 'undefined') {
    console.log('   ✓ 初始化标志已定义:', samplingAnomalyModuleInitialized);
} else {
    console.log('   ✗ 初始化标志未定义');
}

// 2. 检查关闭函数
console.log('\n✅ 检查 2: 关闭函数完整性');
const closeFunctions = [
    'closeAddSamplingAnomalyModal',
    'closeSamplingAnomalyDetailModal',
    'closeSamplingAnomalyExportModal'
];

closeFunctions.forEach(funcName => {
    if (typeof window[funcName] === 'function') {
        console.log(`   ✓ ${funcName} 已定义`);
        
        // 检查函数是否包含关键代码
        const funcStr = window[funcName].toString();
        const checks = {
            'classList.remove': funcStr.includes('classList.remove'),
            'safeSetDisplay': funcStr.includes('safeSetDisplay'),
            'blur()': funcStr.includes('blur()'),
            'console.log': funcStr.includes('console.log')
        };
        
        Object.entries(checks).forEach(([check, passed]) => {
            if (passed) {
                console.log(`      ✓ 包含 ${check}`);
            } else {
                console.log(`      ✗ 缺少 ${check}`);
            }
        });
    } else {
        console.log(`   ✗ ${funcName} 未定义`);
    }
});

// 3. 检查模态框元素
console.log('\n✅ 检查 3: 模态框 DOM 元素');
const modalIds = [
    'addSamplingAnomalyModal',
    'samplingAnomalyDetailModal',
    'samplingAnomalyExportModal'
];

modalIds.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log(`   ✓ ${modalId} 存在于 DOM 中`);
        console.log(`      - display: ${modal.style.display || '默认'}`);
        console.log(`      - classList: ${Array.from(modal.classList).join(', ') || '无'}`);
    } else {
        console.log(`   ✗ ${modalId} 不存在于 DOM 中`);
    }
});

// 4. 检查事件监听器
console.log('\n✅ 检查 4: 事件监听器绑定');
const checkEventListener = (elementId, eventType) => {
    const element = document.getElementById(elementId);
    if (element) {
        // 注意：无法直接检查已绑定的监听器，这里只检查元素是否存在
        console.log(`   ✓ ${elementId} 元素可绑定 ${eventType} 事件`);
    } else {
        console.log(`   ✗ ${elementId} 元素不存在`);
    }
};

checkEventListener('closeAddSamplingAnomalyModal', 'click');
checkEventListener('closeSamplingAnomalyDetailModal', 'click');
checkEventListener('cancelAddSamplingAnomalyBtn', 'click');
checkEventListener('saveSamplingAnomalyBtn', 'click');

// 5. 模拟关闭操作
console.log('\n✅ 检查 5: 模拟关闭操作测试');
try {
    // 测试关闭函数是否抛出错误
    closeAddSamplingAnomalyModal();
    console.log('   ✓ closeAddSamplingAnomalyModal 执行无错误');
    
    closeSamplingAnomalyDetailModal();
    console.log('   ✓ closeSamplingAnomalyDetailModal 执行无错误');
    
    closeSamplingAnomalyExportModal();
    console.log('   ✓ closeSamplingAnomalyExportModal 执行无错误');
} catch (error) {
    console.log('   ✗ 关闭函数执行出错:', error.message);
}

// 6. 检查 CSS 样式
console.log('\n✅ 检查 5: CSS 样式检查');
const styles = window.getComputedStyle(document.documentElement);
const modalZIndex = styles.getPropertyValue('--modal-z-index') || '未定义';
console.log(`   - 模态框 z-index: ${modalZIndex}`);

// 检查 .modal 类的默认 display 值
const modalStyle = getComputedStyle(document.querySelector('.modal') || document.body);
console.log(`   - .modal display: ${modalStyle.display}`);

// 7. 性能检查
console.log('\n✅ 检查 6: 性能检查');
const startTime = performance.now();
for (let i = 0; i < 10; i++) {
    closeAddSamplingAnomalyModal();
    closeSamplingAnomalyDetailModal();
    closeSamplingAnomalyExportModal();
}
const endTime = performance.now();
const totalTime = endTime - startTime;
const avgTime = totalTime / 30; // 3 个函数 × 10 次
console.log(`   - 执行 30 次关闭操作总耗时：${totalTime.toFixed(2)}ms`);
console.log(`   - 平均每次关闭耗时：${avgTime.toFixed(2)}ms`);
console.log(`   - 性能评级：${avgTime < 10 ? '优秀' : avgTime < 50 ? '良好' : '需优化'}`);

// 8. 内存检查（简单版）
console.log('\n✅ 检查 7: 内存泄漏初筛');
const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : '不支持';
console.log(`   - 初始内存占用：${initialMemory}`);

// 创建和销毁 100 个模态框
for (let i = 0; i < 100; i++) {
    const div = document.createElement('div');
    div.className = 'modal';
    document.body.appendChild(div);
    document.body.removeChild(div);
}
const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : '不支持';
console.log(`   - 操作后内存占用：${finalMemory}`);

if (typeof initialMemory === 'number' && typeof finalMemory === 'number') {
    const memoryDiff = finalMemory - initialMemory;
    const memoryDiffMB = (memoryDiff / 1024 / 1024).toFixed(2);
    console.log(`   - 内存变化：${memoryDiffMB} MB`);
    console.log(`   - 内存评级：${Math.abs(memoryDiffMB) < 1 ? '优秀' : Math.abs(memoryDiffMB) < 5 ? '良好' : '注意'}`);
}

// 9. 总结
console.log('\n' + '='.repeat(50));
console.log('✅ 验证完成！请检查以上结果');
console.log('='.repeat(50));
console.log('\n📋 下一步操作:');
console.log('1. 打开采样点异常排查页面');
console.log('2. 测试模态框的打开/关闭功能');
console.log('3. 测试点击外部关闭功能');
console.log('4. 观察控制台日志输出');
console.log('5. 检查是否有 JavaScript 错误');
console.log('\n 提示：如果所有检查都通过，说明修复成功！');
