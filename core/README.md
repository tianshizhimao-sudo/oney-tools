# Oney & Co — Core Module

**Version**: 1.0.0  
**Date**: 2026-02-04

统一的核心模块，为所有 Oney & Co 工具提供共享的样式、组件和工具函数。

---

## 📁 文件结构

```
core/
├── brand.css       # 品牌样式和 CSS 变量
├── storage.js      # 数据存储管理
├── components.js   # UI 组件库
├── utils.js        # 工具函数
└── README.md       # 本文档
```

---

## 🎨 brand.css

### CSS 变量

```css
/* 主色 */
--oney-green: #2ECC85;
--oney-green-dark: #1FAD73;
--oney-gradient: linear-gradient(135deg, #2ECC85, #1FAD73);

/* 背景 */
--bg-primary: #0a0a0a;
--bg-card: #141414;

/* 文字 */
--text-primary: #ffffff;
--text-secondary: #a3a3a3;

/* 状态 */
--status-success: #00d9a5;
--status-warning: #ffc107;
--status-danger: #ff6b6b;
```

### 组件类

| 类名 | 用途 |
|------|------|
| `.card` | 卡片容器 |
| `.card-featured` | 特色卡片（绿色边框） |
| `.card-premium` | 高级卡片（金色边框） |
| `.btn` `.btn-primary` `.btn-secondary` | 按钮 |
| `.form-input` `.form-select` | 表单元素 |
| `.badge` `.badge-free` `.badge-pro` | 徽章 |
| `.metric` `.metric-value` `.metric-label` | 指标显示 |
| `.status-bar` `.status-pass` `.status-warn` `.status-fail` | 状态条 |

---

## 💾 storage.js

### OneyStorage API

```javascript
// 核心存储
OneyStorage.get(key, defaultValue)
OneyStorage.set(key, value)
OneyStorage.remove(key)

// 用户配置
OneyStorage.getProfile()
OneyStorage.updateProfile({ income: { salary: 100000 } })
OneyStorage.updateSection('property', { value: 800000 })

// 会话认证
OneyStorage.isAuthenticated()
OneyStorage.setAuthenticated(true)

// 计算历史
OneyStorage.saveCalculation('tool-id', data)
OneyStorage.getRecentCalculations('tool-id', 10)

// URL 参数
OneyStorage.applyUrlParams()  // 自动在 DOMContentLoaded 调用
OneyStorage.generateUrl('tool.html', { loan: 500000 })
```

### 用户配置结构

```javascript
{
  personal: { name, email, phone },
  income: { salary, rental, business, other },
  expenses: { living, existing_debt, other },
  property: { value, existing_debt, state, type },
  business: { name, industry, abn, revenue, ebitda, ebit }
}
```

### URL 参数传递

工具间可以通过 URL 传递数据:

```
calculator.html?loan=500000&property_value=800000&rate=6.5
```

会自动填充到对应的配置字段。

---

## 🧩 components.js

### OneyUI API

```javascript
// Logo
OneyUI.logo({ width: 180, height: 75, variant: 'full' })
OneyUI.watermark()
OneyUI.faviconUrl()

// 表单
OneyUI.input({ id, label, placeholder, type, format })
OneyUI.select({ id, label, options, value })
OneyUI.formatNumber(inputElement)
OneyUI.parseNumber('1,234,567')

// 卡片
OneyUI.card({ title, icon, content, variant })
OneyUI.toolCard({ href, icon, name, description, badge, variant, disabled })

// 指标
OneyUI.metric({ id, value, label, status })
OneyUI.metricsGrid([...metrics], columns)
OneyUI.statusBar({ id, text, status })

// 按钮
OneyUI.button({ text, icon, variant, size, pill, full, onclick })

// Modal
OneyUI.modal({ id, title, content, showClose })
OneyUI.openModal('modalId')
OneyUI.closeModal('modalId')

// 密码门
OneyUI.passwordGate({ password, title, description })
OneyUI.checkPassword()
OneyUI.isAuthenticated()

// Toast
OneyUI.toast('Message', { type: 'success', duration: 3000 })

// Loading
OneyUI.loading(true, { text: 'Loading...' })

// 剪贴板
OneyUI.copyToClipboard(text, 'Copied!')

// 布局
OneyUI.sectionTitle('Title', '📊')
OneyUI.footer({ email, showYear })

// 初始化
OneyUI.initPage({ password, requireAuth })
```

---

## 🔧 utils.js

### OneyUtils API

```javascript
// 数字格式化
OneyUtils.formatNumber(1234567)        // "1,234,567"
OneyUtils.formatCurrency(50000)        // "$50,000"
OneyUtils.formatPercent(75.5)          // "75.50%"
OneyUtils.formatMultiple(1.5)          // "1.50x"
OneyUtils.formatCompact(1500000)       // "1.5M"
OneyUtils.parseNumber('$1,234')        // 1234

// 日期
OneyUtils.formatDate(new Date())       // "03 Feb 2026"
OneyUtils.timeAgo(pastDate)            // "2 hours ago"

// 金融计算
OneyUtils.calcMonthlyRepayment(principal, rate, years)
OneyUtils.calcInterestOnly(principal, rate)
OneyUtils.calcAnnualInterest(principal, rate)
OneyUtils.calcLVR(loan, propertyValue)
OneyUtils.calcICR(income, interest)
OneyUtils.calcDSCR(noi, debtService)
OneyUtils.getStatus(value, passThreshold, warnThreshold, isHigherBetter)

// 澳洲数据
OneyUtils.AU_STATES    // [{ value: 'NSW', label: 'New South Wales' }, ...]
OneyUtils.PROPERTY_TYPES
OneyUtils.INDUSTRIES

// 验证
OneyUtils.isValidEmail(email)
OneyUtils.isValidPhone(phone)
OneyUtils.isValidABN(abn)

// DOM 辅助
OneyUtils.$(id)                        // document.getElementById
OneyUtils.getValue(id)
OneyUtils.getNumericValue(id)
OneyUtils.setValue(id, value)
OneyUtils.setText(id, text)
OneyUtils.setHTML(id, html)
OneyUtils.toggleClass(id, className, force)
OneyUtils.show(id, visible)

// 函数工具
OneyUtils.debounce(fn, 300)
OneyUtils.throttle(fn, 300)

// 其他
OneyUtils.generateId('prefix')
OneyUtils.deepClone(obj)
OneyUtils.isEmpty(obj)
OneyUtils.sleep(ms)
```

---

## 🚀 快速开始

### 新工具模板

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Tool — Oney & Co</title>
  <link rel="icon" href="data:image/svg+xml,...">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="core/brand.css">
</head>
<body>
  <div class="container-narrow">
    <header class="text-center p-lg">
      <div id="logo"></div>
      <h1>My Tool</h1>
    </header>
    
    <div class="card">
      <div class="card-title">📋 Input</div>
      <!-- Form content -->
    </div>
    
    <button class="btn btn-primary btn-full">Calculate</button>
  </div>

  <script src="core/storage.js"></script>
  <script src="core/components.js"></script>
  <script src="core/utils.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Add watermark
      document.body.insertAdjacentHTML('afterbegin', OneyUI.watermark());
      
      // Insert logo
      document.getElementById('logo').innerHTML = OneyUI.logo();
      
      // Load saved data
      const profile = OneyStorage.getProfile();
      // ...
    });
  </script>
</body>
</html>
```

---

## 📝 迁移指南

将现有工具迁移到新架构：

1. **替换内联 CSS**
   - 删除 `<style>` 块中的通用样式
   - 添加 `<link rel="stylesheet" href="core/brand.css">`
   - 保留页面特定样式

2. **使用组件**
   - 替换内联 Logo SVG → `OneyUI.logo()`
   - 替换水印 SVG → `OneyUI.watermark()`
   - 使用 `OneyUI.formatNumber()` 替换本地函数

3. **使用存储**
   - 用 `OneyStorage.getProfile()` 预填表单
   - 用 `OneyStorage.saveCalculation()` 保存结果
   - 用 `OneyStorage.isAuthenticated()` 检查认证

4. **使用工具函数**
   - 用 `OneyUtils.formatCurrency()` 格式化金额
   - 用 `OneyUtils.calcLVR()` 等进行计算
   - 用 `OneyUtils.$()` 简化 DOM 操作

---

## 🔄 版本历史

### v1.0.0 (2026-02-04)
- 初始版本
- 基础 CSS 变量和组件
- localStorage 数据管理
- UI 组件库
- 工具函数集

---

*Oney & Co — Financial Health for Everyone*
