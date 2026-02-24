# Oney Security Data Layer

## 文件说明

| 文件 | 用途 | 来源 |
|------|------|------|
| `apra-definitions.json` | APRA 商业地产分类 + 通用定义 | APRA CRE Definitions (权威) |

## 数据结构

### apra-definitions.json

```
├── propertyCategories[]     ← APRA 7大物业分类 (OFC/RTL/IDL/TL/OTH/OR/LDS)
│   ├── code                 ← 缩写代码 (用于工具间传递)
│   ├── name                 ← 全称
│   ├── description          ← APRA 官方描述
│   ├── examples[]           ← 举例
│   ├── subTypes[]           ← 子分类 (如 TL 的酒店/汽车旅馆/酒吧)
│   ├── riskProfile          ← standard / elevated / high
│   └── notes[]              ← APRA 备注
├── importantRules[]         ← 多物业/混合用途规则
├── generalDefinitions[]     ← 通用术语定义
│   ├── term                 ← 术语名称
│   ├── definition           ← 定义
│   ├── category             ← 分类 (income/compliance/valuation/finance/tenancy/serviceability)
│   ├── relevantModules[]    ← 相关 Oney Security 模块
│   ├── riskFlag             ← 是否需要标记风险
│   └── riskNote             ← 风险说明
└── riskProfiles{}           ← 风险等级定义
```

## 工具间流通

### 在 Oney Security 中使用
```javascript
const data = await fetch('data/apra-definitions.json').then(r => r.json());
const categories = data.propertyCategories;
const definitions = data.generalDefinitions;
```

### 在其他 Oney 工具中使用
```javascript
// 方式1: 直接引用 (同域)
const APRA = await fetch('/data/apra-definitions.json').then(r => r.json());

// 方式2: 通过 OneyStorage 共享
OneyStorage.set('apra', 'categories', categories);

// 方式3: URL 参数传递选中的物业类型
window.location.href = `security.html?propertyCode=OFC&subType=gradeA`;
```

### 数据流通标准
- 物业类型用 `code` 字段传递 (OFC/RTL/IDL/TL/OTH/OR/LDS)
- 风险等级用 `riskProfile` (standard/elevated/high)
- 模块关联用 `relevantModules` 数组

## 后续数据文件 (计划)

| 文件 | 内容 |
|------|------|
| `office-grades.json` | 商业办公室等级 (Premium/A/B/C/D) |
| `retail-centres.json` | 零售中心定义 (Regional/Sub-Regional/Neighbourhood 等) |
| `residential-dev.json` | 住宅开发定义 |
| `metro-classifications.json` | ABS Metro/Non-Metro 分类 |
| `lender-appetite.json` | 各类 lender 对各物业类型的接受度 (杀手功能数据) |
| `cap-rate-benchmarks.json` | 各物业类型/城市的 Cap Rate 基准 |
