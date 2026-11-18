# 蓝瀚媒体代理业务OpenApi对接文档 （V1\.0）

> 历史变更记录 （  A\-新增，M\-修改 ， D\-删除 ， C\-创建 ）
> 
> 



|**时间**|**版本号**|**变更人**|**主要变更内容**|
|---|---|---|---|
|2026年11月04日|v1\.0|刘大卫|A\-新增新兴媒体（小媒体）code以及对应名称|
|2026年10月15日|v1\.0|曲锐|M\-完善Snapchat开户申请接口，补充行业参数（industry）格式说明|
|2026年10月9日|v1\.0|刘大卫|A\-新增TikTok东南亚美金开户与账户管理接口、open\-ai开户与账户管理接口|
|2026年6月4日|v1\.0|曲锐|A\-附录TikTok部分补充账户状态\(account\_status\)枚举说明|
|2026年4月10日|v1\.0|赵奔|M\-Tiktok银联验证接口新增请求参数register\_area\_code，非中国大陆直接返回不需要银联验证|
|2025年07月03日|v1\.0|曲锐|P\-完善Tiktok开户申请接口，补充对于行业参数的说明|
|2025年03月13日|v1\.0|李玉琦|A\-新增实时查询广告账号状态\&余额接口|
|2025年03月13日|v1\.0|贾敏|[A\-Tiktok 中国区开户需要银联验证信息](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#share-KeN6d7KngorwRpxzJLBcVYw3nQg)|
|2024年06月14日|v1\.0|张卫强|A\-大媒体账户管理需求申请记录接口支持申请ID和解封清零记录查询参数|
|2024年4月7日|v1\.0|张卫强|M\-完善接口文档|
|2024年1月24日|V1\.0|张卫强|A\-新增google查询账户状态|
|2023年2月15日|V1\.0|周柯|A\-新增tiktok更名、google时区列表、tiktok时区、地区、行业等接口|
|2023年2月7日|V1\.0|周柯|A\-新增（新增申请的返回值apply\_id）|
|2023年1月1日|V1\.0|周柯|C\-创建文档|

# 一、背景\&目标

伴随出海业务的不断发展，蓝瀚互动服务的客户类型和数量不断增多，为了满足一些具备技术能力的客户的API对接需求背景下，在不影响普通用户的交互体验的情况下，蓝瀚依托一级代理商资质为这类客户提供API对接的解决方案，满足客户通过自建系统自动化的完成Meta\(facebook\)、谷歌、TikTok媒体的开户管理以及Meta\(facebook\)、google、tiktok、大量新兴媒体的账户工单需求管理，同时支持Meta\(facebook\)、谷歌、Tiktok、Twitter等媒体的消耗等基础数据指标的获取和分析等，帮助客户进行业务提效，实现业务的更好发展。

# 二、接口协议

**全局响应示例**

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,  // 返回码
    "info": "",  // 返回提示信息
    "data": null,  // 返回的数据 
    "request_id": "165364773448121001" // 返回的唯一请求ID
}
```



**全局返回码说明如下：**

|**返回码**|**返回信息**|**描述**|
|---|---|---|
|\-1|TIMEOUT|系统繁忙，此时请开发者稍候再试|
|0|SUCCESS|请求成功|
|40001|PERMISSION\_ERROR|没有权限进行相关操作，access token无效、过期或者错误|
|40002|PARAMETER\_ERROR|参数错误|
|40004|IP\_NOT\_ALLOWED|调用接口的IP地址不在白名单中，申请开发者账号时的official\_ips|
|40005|CODE\_EXPIRED|换取token的code过期，已失效|
|40006|METHOD\_NOT\_ALLOWED|请求方式不允许|
|40104|EMPTY\_ACCESS\_TOKEN|access token为空|
|40105|SOURCE\_NOT\_FOUNT|当前用户请求的资源不存在|
|40300|SERVER\_ERROR|内部服务异常|
|40404|API\_NOT\_FOUND|请求的接口不存在|
|40409|CONFLICT|已提交，5秒内不可重复提交|
|50000|SYS\_ERROR|系统错误|

## 开发者账号申请及授权

#### 申请开发者账号

> 请联系蓝瀚对接销售或ae及技术咨询相关授权对接流程，获取必要的用户凭证。
> 
> 





## 数据概览

#### 数据概览（媒体（meta\(facebook\)、google、tiktok、twitter）维度为account级别）

|接口|说明|
|---|---|
|消耗概览|获取昨天、前天、近七天、近28天、近三个月的消耗和环比|
|消耗趋势|获取（meta、google、tiktok、twitter）媒体每天的消耗趋势|
|媒体详情|获取（meta、google、tiktok、twitter）媒体的媒体详情|
|账户天级消耗|获取选定日期的每天有帐户的消耗数据|

##### 消耗概览



请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/dashboard/brand\_dash

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|value|是否必填|说明|
|---|---|---|---|
|module|base\_spend|Y|消耗概览接口的类型|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "module=base_spend" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/dashboard/brand_dash
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|yesterday|map|昨天用户总消耗和环比|
|day\_before\_yesterday|map|前天用户总消耗和环比|
|nearly\_week|map|近一周用户总消耗和环比|
|nearly\_month|map|近一月用户总消耗和环比|
|nearly\_3months|map|近三月用户总消耗和环比|
|day\_before\_yesterday\_date|string|前天日期<br>|
|spend|string|用户总消耗|
|chain|string|用户环比|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
   "code": 0,
    "data": {
        "day_before_yesterday": {
            "spend": "72.26",
            "chain": -0.339
        },
        "yesterday": {
            "spend": "67.40",
            "chain": -0.069
        },
        "nearly_week": {
            "spend": "722.81",
            "chain": -0.242
        },
        "nearly_month": {
            "spend": "44268.24",
            "chain": -0.243
        },
        "nearly_3months": {
            "spend": "103942.83",
            "chain": 4.754
        },
        "day_before_yesterday_date": "2023-01-01"
    },
    "info": null,

}

```

##### 媒体消耗明细



请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/dashboard/brand\_dash

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|value|是否必填|说明|
|---|---|---|---|
|module|spend\_trend|Y|消耗趋势接口的类型|
|dash\_time<br>|2022\-12\-27,2023\-01\-02<br>|Y|消耗趋势的日期范围<br>|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "module=spend_trend" \
--data-urlencode "dash_time=2022-12-27,2023-01-02" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/dashboard/brand_dash
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|time|string|日期|
|facebook|string|facebook的当天消耗|
|google|float|google的当天消耗|
|tiktok|float|tiktok的当天消耗|
|twitter|float|twitter的当天消耗|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "data": [
        {
            "time": "2022-12-27",
            "facebook": 106.33000000000001,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        },
        {
            "time": "2022-12-28",
            "facebook": 101.5,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        },
        {
            "time": "2022-12-29",
            "facebook": 81.92000000000002,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        },
        {
            "time": "2022-12-30",
            "facebook": 184.3,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        },
        {
            "time": "2022-12-31",
            "facebook": 109.1,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        },
        {
            "time": "2023-01-01",
            "facebook": 72.25999999999999,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        },
        {
            "time": "2023-01-02",
            "facebook": 67.4,
            "google": 0.0,
            "tiktok": 0.0,
            "twitter": 0.0
        }
    ],
    "info": null,

}

```

##### 媒体详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/dashboard/brand\_dash

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|value|是否必填|说明|
|---|---|---|---|
|module|medium\_detail|Y|媒体消耗明细接口的类型|
|dash\_time|2022\-12\-27,2023\-01\-02|Y|媒体消耗明细的日期范围|
|medium|0,5,18,21|N|媒体类型（0:facebook,5:tiktok,18:google,21:twitter）|
|accounts|1435136480300111,1019800355345098|N|账户id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "module=medium_detail" \
--data-urlencode "dash_time=2022-12-27,2023-01-02" \
--data-urlencode "medium=0,5,18,21" \
--data-urlencode "accounts=1435136480300111,1019800355345098" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/dashboard/brand_dash
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|base\_spend|map|媒体详情时间段内总基本信息（消耗、cpc、cpm、cpi）|
|spend\_detail<br>|map|时间段内媒体详情的信息（消耗、impression、cpv、cpm、cpc、ctr、vtr、cpi、clicks、video\_views）|
|title|list|某个时间段|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "data": {
        "base_spend": {
            "spend": {
                "value": 758.9
            },
            "cpc": {
                "value": 0.217015
            },
            "cpm": {
                "value": 10.418000000000001
            },
            "cpi": {
                "value": 0
            }
        },
        "spend_detail": {
            "spend": [
                103.49000000000001,
                106.33000000000001,
                101.5,
                81.92000000000002,
                184.3,
                109.1,
                72.25999999999999
            ],
            "impression": [
                6699.0,
                8067.0,
                7779.0,
                7202.0,
                26719.0,
                9919.0,
                6462.0
            ],
            "cpv": [
                0.017763,
                0.015315,
                0.015298,
                0.023704,
                0.032367,
                0.013704,
                0.016449
            ],
            "cpm": [
                15.449,
                13.181,
                13.048,
                11.375,
                6.898,
                10.999,
                11.181999999999999
            ],
            "cpc": [
                0.240116,
                0.21568,
                0.231735,
                0.297891,
                0.187107,
                0.207021,
                0.207644
            ],
            "ctr": [
                0.064338,
                0.061113,
                0.056305,
                0.038184,
                0.036865,
                0.05313,
                0.053853
            ],
            "vtr": [
                0.869682,
                0.860667,
                0.852937,
                0.479867,
                0.213107,
                0.802601,
                0.67982
            ],
            "cpi": [
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0
            ],
            "clicks": [
                431.0,
                493.0,
                438.0,
                275.0,
                985.0,
                527.0,
                348.0
            ],
            "video_views": [
                5826.0,
                6943.0,
                6635.0,
                3456.0,
                5694.0,
                7961.0,
                4393.0
            ]
        },
        "title": [
            "2022-12-26",
            "2022-12-27",
            "2022-12-28",
            "2022-12-29",
            "2022-12-30",
            "2022-12-31",
            "2023-01-01"
        ]
    },
    "info": null,

}

```

##### 广告账户天级消耗



请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/dashboard/brand\_dash

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|value|是否必填|说明|
|---|---|---|---|
|module|export\_detail|Y|账户天级消耗接口的类型|
|dash\_time|2022\-12\-27,2023\-01\-02|Y|媒体详情的日期范围|
|medium|0,5,18,21|N|媒体类型（0:facebook,5:tiktok,18:google,21:twitter）|
|accounts|1435136480300111,1019800355345098|N|账户id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "module=export_detail" \
--data-urlencode "dash_time=2022-12-27,2023-01-02" \
--data-urlencode "medium=0,5,18,21" \
--data-urlencode "accounts=1435136480300111,1019800355345098" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/dashboard/brand_dash
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|spend\_date|string|消耗日期|
|medium|int|媒体（0:facebook、5:tiktok、18:google、21:twitter）|
|account\_id|string|账户id|
|spend|string|消耗|
|account\_name|string|账户名称|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "data": [
        {
            "spend_date": "2023-01-02",
            "medium": 0,
            "account_id": "1290073488226874",
            "spend": "0.00",
            "account_name": "Heaeetu-1"
        },
        {
            "spend_date": "2023-01-02",
            "medium": 0,
            "account_id": "783009749420473",
            "spend": "43.11",
            "account_name": "humility-yeahoone-蓝瀚02"
        },
        {
            "spend_date": "2023-01-02",
            "medium": 0,
            "account_id": "802597127540944",
            "spend": "24.72",
            "account_name": "humility-yeahoone-蓝瀚03"
        },
        {
            "spend_date": "2023-01-03",
            "medium": 0,
            "account_id": "1486316998548548",
            "spend": "5.25",
            "account_name": "humility-蓝瀚-ytuos-03"
        },
        {
            "spend_date": "2023-01-03",
            "medium": 0,
            "account_id": "783009749420473",
            "spend": "40.29",
            "account_name": "humility-yeahoone-蓝瀚02"
        },
        {
            "spend_date": "2023-01-03",
            "medium": 0,
            "account_id": "802597127540944",
            "spend": "27.00",
            "account_name": "humility-yeahoone-蓝瀚03"
        }
    ],
    "info": null,
    "request_id": "13123131"
}

```

#### 开户管理

|接口|说明|
|---|---|
|facebook开户申请|通过facebook提供的request\_id进行添加开户|
|facebook开户列表|查看当前用户facebook开户的列表|
|facebook开户详情|查看当前用户facebook某个request\_id开户详情|
|google开户申请|填写google相关开户信息进行开户|
|google开户列表|google开户申请列表|
|google申请撤回|google申请撤回|
|google详情|google开户详情|
|tiktok上传营业执照|tiktok上传营业执照|
|tiktok开户申请|填写tiktok相关开户信息进行开户|
|tiktok开户列表|tiktok开户申请列表|
|tiktok申请撤回|tiktok申请撤回|
|tiktok详情|tiktok开户详情|

##### Facebook

###### 开户申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/fb\_list

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|request\_id|list|Y|facebook提供的oe request\_id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
    "request_id": [""],
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/fb_list
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": "成功",
    "data":[]
}
失败结果：
{
    "data": [
    ],
    "info": "xxx，xxxx 未保存成功，请联系蓝瀚互动AE",
    "code": -1
}

```



###### 开户列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/fb\_list

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|request\_id|string|890894888576746,890894888576741|N|支持指定oe request\_id的查询|
|account\_id|string|901916791257516,901916791257517|N|支持faceboook的查询|
|entity\_name<br>|string|新余明辩电子商务有限公司，新余明辩电子商务有限公司|N|支持开户主体的查询|
|status|string|0,1,2,3,4,5,6|N|支持facebook开户的状态查询（[见下附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#BII4dWOomoK62cxS8FKcFFcvnpd)）|
|is\_confirm|int|0|N|支持提交状态查询 （0:未提交 1:已提交）|
|apply\_date|string|2023\-01\-04 00:13:07,2023\-01\-04 15:06:36|N|申请时间|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

开户列表的状态会随着审批实时变动 直到开户完成

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "request_id=890894888576746,890894888576741" \
--data-urlencode "account_id=901916791257516,901916791257517" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/fb_list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|request\_id|string|facebook的申请id|
|vertical|string|行业类型|
|status|int|开户状态（[见下附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#BII4dWOomoK62cxS8FKcFFcvnpd)）|
|promotable\_page\_ids|string|粉丝页|
|promotable\_urls|string|Promotable Urls|
|official\_website\_url|string|Official Website Url|
|promotable\_urls|list\<striing\>|投放链接|
|num|int|开户账户数量|
|entity\_name|string|开户主体|
|is\_confirm|int<br>|开户申请提交状态，<br>0:未提交，1:已提交|
|reason|string|审核驳回原因|
|remark|string|确认提交备注|
|apply\_date|string|开户时间|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "request_id": "158754631708937",
                "entity_name": "武汉旺叮咚电子商务有限公司",
                "vertical": "Ecommerce",
                "promotable_page_ids": "['2218210298225426', '1047828632073697']",
                "official_website_url": [
                    "http://www.ynjbw.com/"
                ],
                "promotable_app_ids": [
                ],
                "apply_date": "2019-03-13T16:48:51",
                "promotable_urls": [
                    "[\"http://www.ynjbw.com/\"]"
                ],
                "num": 1,
                "is_confirm": 0,
                "reamrk": null,
                "status": 3,
                "reason": "[{\"note\": \"AUTO-GENERATED: this request has been pending for more than 7 business days.\", \"reason\": \"Request-change window expired\"}]"
            },
            {
                "request_id": "528050488295620",
                "entity_name": "黑龙江昊雷商贸有限公司",
                "vertical": "Ecommerce",
                "promotable_page_ids": "[]",
                "official_website_url": [
                    "http://www.yehlstore.com/"
                ],
                "promotable_app_ids": [
                ],
                "apply_date": "2021-08-28T15:45:21",
                "promotable_urls": [
                    "[\"http://www.yehlstore.com/\"]"
                ],
                "num": 2,
                "is_confirm": 1,
                "reamrk": "必须有备注吗",
                "status": 0,
                "reason": ""
            },
            {
                "request_id": "406134300129381",
                "entity_name": "深圳市前海金瑞电子商务有限公司",
                "vertical": "Ecommerce",
                "promotable_page_ids": "['1742451962497390']",
                "official_website_url": [
                    "http://www.wazor.com/"
                ],
                "promotable_app_ids": [
                ],
                "apply_date": "2019-01-08T16:38:15",
                "promotable_urls": [
                ],
                "num": 1,
                "is_confirm": 0,
                "reamrk": null,
                "status": 4,
                "reason": "[]"
            }
        ],
        "pagination": {
            "page_size": 10,
            "current_page": 1,
            "total": 3
        }
    },
    "info": null,
    "code": 0
}

```



###### 开户详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/fb\_list/\{request\_id\}

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数



请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/fb_list/12212343454463654
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|accounts|list\< ACCOUNT\>|下户账户|
|apply\_date|string|开户申请时间|
|entity\_name|string|开户主体|
|num|int|开户数量|
|request\_id|string|开户request\_id|

ACCOUNT

|字段名|类型|说明|
|---|---|---|
|account\_id|string|账户ID|
|account\_name|string|账号名称|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "request_id": "411108917674765",
        "entity_name": "广州迪通贸易服务有限公司",
        "num": 1,
        "apply_date": "2022-09-02T13:39:30",
        "accounts": [
        ]
    },
    "info": null,
    "request_id": "13123131",
    "code": 0
}

```

##### Google

###### 开户申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/gg\_accounts

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|customer\_subject|string|Y|开户主体|
|customer\_type|string|Y|客户类型（0:直客 1:代理）|
|account\_number|int|Y|开户数量|
|currency|string|Y|币种[（0:USD 1:HKD 2:CNY）](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#CqEyd8Oakoc0omxwrp2cAvctnzh)|
|industry\_type|string|Y|行业类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#CqEyd8Oakoc0omxwrp2cAvctnzh)）|
|time\_zone|string|Y|时区（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#CqEyd8Oakoc0omxwrp2cAvctnzh)）|
|product\_url|list\<string\>|Y|产品链接|
|throw\_area|list\<string\>|Y|投放地区（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#CqEyd8Oakoc0omxwrp2cAvctnzh)）|
|remark|string|N|申请备注|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"customer_subject":"12313",
"customer_type":"0",
"account_number":12,
"currency":"0",
"industry_type":"4",
"time_zone":"Africa/Banjul",
"product_url":["123123"],
"throw_area":["2","1"]
,"remark":"备注"
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/gg_accounts
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": []
}
```





###### 开户列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/gg\_accounts

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数  

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|**customer\_subject**|string|黑珑信息科技有限公司,xxx公司|N|支持google开户的开户主体|
|account\_id|string|454\-568\-8539,xxx\-xxx\-xxxx|N|支持google账户的查询|
|gg\_id|string|C11247,C223|N|支持google申请id的查询|
|product\_url|string|www\.jd\.com,www\.baidu\.com|N|支持google申请开户的产品链接|
|apply\_status|string|0,1,2,3,4,5|N|支持申请状态（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#PGuadg0U4oKWiWxETTrchc17nMg)）查询|
|industry\_type|string|0,1,2|N|支持行业类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnvq4SNE6DFThPERdpvDJyic)）查询|
|currency|string|0,1,2|N|支持币种（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#YSwod2aieoeU6WxQpHoc6D1gnMf)）查询|
|apply\_date|string|2023\-01\-04 00:13:07,2023\-01\-04 15:06:36|N|申请时间|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

开户列表的状态会随着审批实时变动 直到开户完成

请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "**customer_subject**=黑珑信息科技有限公司,xxx公司" \
--data-urlencode "account_id=454-568-8539,xxx-xxx-xxxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/gg_accounts
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|google的申请id（与gg\_id意义相同）|
|gg\_id|string|google的申请id|
|customer\_subject|string|google开户主体|
|account\_number|int|google开户数量|
|currency|int|币种|
|industry\_type|int|行业类型|
|product\_url|list\<striing\>|产品链接|
|time\_zone|string|时区|
|throw\_area|list\<striing\>|投放地区|
|apply\_status|int|开户申请状态|
|is\_back|int|是否撤回 0:未撤回，1:已撤回|
|reason|string|审核驳回原因|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "id": 410,
                "gg_id": "C410",
                "customer_subject": "开户主体3463874623",
                "account_number": 4,
                "currency": 0,
                "industry_type": 0,
                "product_url": [
                    "3426347235423764"
                ],
                "time_zone": "(GMT+00:00) Africa/Abidjan",
                "throw_area": [
                    "0"
                ],
                "apply_status": 0,
                "is_back": 0,
                "reason": ""
            }
        ],
        "pagination": {
            "page_size": 10,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code": 0
}


```





###### 开户详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/gg\_accounts/\{id\}

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数



请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/gg_accounts/11211
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|accounts|list\< ACCOUNT\>|下户账户|
|apply\_date|string|开户申请时间|
|customer\_subject|string|开户主体|
|account\_number|int|开户数量|
|apply\_user|string|申请人|
|approval\_date|string|审核时间|
|customer\_remark|string|客户备注|
|gg\_id|string|申请id|
|records|list\< RECORDS\>|操作记录|

ACCOUNT

|字段名|类型|说明|
|---|---|---|
|account\_id|string|账户ID|
|account\_name|string|账号名称|

RECORDS

|字段名|类型|说明|
|---|---|---|
|action|int|操作记录状态（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#EkICd2cocoguqyx8dPwcEoXAnKc)）|
|time|string|操作时间|
|user|string|操作人|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "gg_id": "C412",
        "account_number": 12,
        "customer_subject": "12313",
        "apply_user": "lizhen@domob.cn",
        "apply_date": "2023-01-04T16:42:17",
        "approval_date": null,
        "customer_remark": "12312313企鹅委屈",
        "accounts": [
        ],
        "records": [
            {
                "action": 0,
                "user": "lizhen@domob.cn",
                "time": "2023-01-04T16:42:17"
            }
        ]
    },
    "info": null,
    "code": 0
}


```

###### 申请撤回

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/gg\_accounts\_back

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|id|list\<int\>|Y|谷歌申请id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"id":"[12313]",
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/gg_accounts_back
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": []
}
```

###### 申请时区

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/get\_time\_zone

- Method：GET

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X GET \

https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/get_time_zone
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": [
    {"value": "(GMT+00:00) Africa/Abidjan", "key": "Africa/Abidjan"},
    {"value": "(GMT+00:00) Africa/Accra", "key": "Africa/Accra"},
    {"value": "(GMT+03:00) Africa/Addis_Ababa", "key": "Africa/Addis_Ababa"},
    ]
}
```

##### TikTok

###### 营业执照上传

> 在商业中心中为注册地为中国大陆、香港，需要上传的是营业执照。 上传后返回的business\_registration字段将用于tiktok申请接口的business\_registration字段（适用于注册地为中国大陆或香港的广告商）
> 
> 资质证书文件，仅支持图片格式\(JPG/JPEG/PNG\)。文件大小最大为10 MB。
> 
> 

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tt\_upload\_br

- Method：POST

- Content\-Type:  multipart/form\-data

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|br\_file|file|Y|开户主体营业执照图片格式\(JPG/JPEG/PNG\)|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
--form 'br_file=@"filepath"' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tt_upload_br

```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|business\_registration|string|资质证书文件下载地址，同一个商户，可重复使用|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": {
    "business_registration": "https://kp-tt-br-test-1306172567.cos.na-siliconvalley.myqcloud.com/ka_support_tt/1496a9c09560b241884ce5f07365e1cb.png"
    }
}
```

###### 开户申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tt\_oa

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|示例|
|---|---|---|---|---|
|entity\_name|string|Y|开户主体||
|industry|string|Y|行业类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnjWRWnn6RTZM0z5EyJElxWb)）取值为：[tiktok申请行业列表接口](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#share-VVeednTeuoQB6QxmFVWc7hwhnmd)中三级行业child中的name|EC/零售\&电商/综合类2B电商|
|industry\_id|int|Y|行业类型id（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnjWRWnn6RTZM0z5EyJElxWb)）取值为：[tiktok申请行业列表接口](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#share-VVeednTeuoQB6QxmFVWc7hwhnmd)中三级行业child中的key||
|account\_type|int|Y|账户类型（1:竞价、2:品牌）<br>账号类型选择说明：<br>品牌账户用于品牌合约广告下单使用<br>不可用于竞价效果广告投放既无法操作投放及充值||
|account\_num|int|Y|开户数量||
|timezone|string|Y|时区标识，格式: \(`time`\)`name`\-`code` , `time` 、`name` 、`code` 值参见附录Tiktok时区信息||
|timezone\_code|string|Y|时区（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnc4Cs08K6TNMRxsv3o4X8De)）||
|promotable\_urls|list\<string\>|Y|投放链接||
|business\_registration\_id|string|Y|统一社会信用代码||
|register\_area\_name|string|Y|注册地（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcn3es9hnRwqVbs7fy4c4l2cf)）||
|register\_area\_code|string|Y|注册地 code（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcn3es9hnRwqVbs7fy4c4l2cf)）||
|business\_registration|string|Y|营业执照上传url||
|customer\_note|string|N|客户备注||
|**unionpay\_verification\_required**|**string**|**N**|**是否需要银联验证**<br>|注册地： 中国， 需要进行前置检查<br>[tt\_unionpay\_info\_check](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#share-UYJ7dt8hEoG8xMxYXWscPPodnGd)<br><br>若 检查结果<br>`unionpay_verification_required == Yes`<br><br>则需要 银联信息|
|**representative\_name**|string|N|**营业执照上法人的中文名字**||
|**representative\_id**|string|N|**法人的身份证号**||
|**unionpay\_account**|string|N|**银联账号，共 12 到 19 位**||
|**representative\_phone\_number**|string|N|**representative\_phone\_number**<br>||

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"entity_name":"12313",
"industry":"Fintech/互联网金融/贵金属",
"industry_id":292606,
"account_type":1,
"account_num":2,
**"timezone": "(UTC+00:00)非洲/阿克拉-Africa/Accra"**
**"timezone_code": "Africa/Accra"**
"promotable_urls":["www.baidu.com"],
"business_registration_id":"1312313",
"business_registration": "https://kp-tt-br-test-1306172567.cos.na-siliconvalley.myqcloud.com/ka_support_tt/e7af51ca3c487cfd52302562acdd70e0.png"
,"customer_note":"备注"
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tt_oa
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": {
        "apply_id": 111
    }
}
```





###### 银联验证检查 （**`注册地： 中国`**** **）

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tt\_unionpay\_info\_check

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|license\_no|string|Y|营业执照编号|
|register\_area\_code|string|Y|注册地code<br>仅"ZH\_CN"中国大陆会进行银联验证，传入其他参数该接口均直接返回不需要银联验证|

请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "license_no=xxxxxxxxxxxxxxx" \
--data-urlencode "register_area_code=CN" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tt_unionpay_info_check
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|unionpay\_verification\_required|string|Yes/No 营业执照是否需要进行验证|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "success": true,
    "data": {
**        "unionpay_verification_required": "Yes" **
    },
    "info": null
}
```



###### 开户列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tt\_list

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数  

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|apply\_id|string|C266,C277|N|支持tiktok申请id查询|
|entity\_name|string|北京开户主体,北京开户主体1|N|支持开户主体的查询|
|account\_id|string|7184631835685601281,7184632277400436738|N|支持tiktok账户id的查询|
|status|string|1,3,4,5,6|N|支持tiktok申请状态查询\([见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#Q6MSdGWa6oUQYgx9bqncnNYmnBA)\)|
|apply\_date|string|2023\-01\-04 00:13:07,2023\-01\-04 15:06:36|N|支持申请时间查询|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

开户列表的状态会随着审批实时变动 直到开户完成

请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "apply_id=C266,C277" \
--data-urlencode "account_id=7184631835685601281,xxxxxxxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tt_list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|tiktok的申请id（与apply\_id意义相同）|
|apply\_id|string|tiktok的申请id|
|entity\_name|string|tiktok开户主体|
|vertical|string|行业类型 （[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnjWRWnn6RTZM0z5EyJElxWb)）|
|account\_type|int|账户类型（1:竞价、2:品牌）|
|account\_num|int|开户数量|
|timezone|string|时区（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnc4Cs08K6TNMRxsv3o4X8De)）|
|promotable\_urls|list\<string\>|投放链接|
|business\_registration\_id|string|统一社会信用代码|
|register\_area|string|注册地（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcn3es9hnRwqVbs7fy4c4l2cf)）|
|business\_registration|string|营业执照|
|status|int|开户状态\([见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#Q6MSdGWa6oUQYgx9bqncnNYmnBA)\)|
|apply\_revoke|int|撤回状态（0:未撤回、1:已撤回）|

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "id": 410,
                "gg_id": "C410",
                "customer_subject": "开户主体3463874623",
                "account_number": 4,
                "currency": 0,
                "industry_type": 0,
                "product_url": [
                    "3426347235423764"
                ],
                "time_zone": "(GMT+00:00) Africa/Abidjan",
                "throw_area": [
                    "0"
                ],
                "apply_status": 0,
                "is_back": 0,
                "reason": ""
            }
        ],
        "pagination": {
            "page_size": 10,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code": 0
}


```





###### 开户详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tt\_list/\{id\}

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数



请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tt_list/330
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|accounts|list\< ACCOUNT\>|下户账户|
|apply\_date|string|开户申请时间|
|entity\_name|string|开户主体|
|account\_number|int|开户数量|
|apply\_user|string|申请人|
|approval\_date|string|审核时间|
|customer\_note|string|客户备注|
|apply\_id|string|申请id|
|records|list\< RECORDS\>|操作记录|

ACCOUNT

|字段名|类型|说明|
|---|---|---|
|account\_id|string|账户ID|
|account\_name|string|账号名称|

RECORDS

|字段名|类型|说明|
|---|---|---|
|action|int|操作记录状态（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#EkoadIU6EoqYgux2t66cGbiZndd)）|
|time|string|操作时间|
|user|string|操作人|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "apply_id": "C330",
        "entity_name": "123",
        "apply_user": "lizhen@domob.cn",
        "apply_date": "2022-11-03T12:50:09+08:00",
        "approval_date": null,
        "customer_note": "",
        "accounts": [
        ],
        "records": [
            {
                "action": 1,
                "time": "2022-11-03T12:50:09+08:00",
                "user": "lizhen@domob.cn"
            },
            {
                "action": 2,
                "time": "2023-01-05T15:27:24+08:00",
                "user": "lizhen@domob.cn"
            }
        ]
    },
    "info": null,
    "code": 0
}


```

###### 开户申请撤回

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tt\_oa\_revoke

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|ids|list\<int\>|Y|tiktok开户申请id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"ids":"[12313]",
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tt_oa_revoke
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": []
}
```

###### 申请时区列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/get\_tt\_timezone

- Method：GET

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X GET \

https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/get_tt_timezone
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": [
        {"key": "Africa/Accra", "value": "(UTC+00:00)非洲/阿克拉-Africa/Accra"},
        {"key": "Africa/Cairo", "value": "(UTC+02:00)非洲/开罗-Africa/Cairo"},
        {"key": "Africa/Casablanca", "value": "(UTC+00:00)非洲/卡萨布兰卡-Africa/Casablanca"}
    ]
}
```

###### 申请注册地列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/get\_tt\_registered\_area

- Method：GET

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X GET \

https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/get_tt_registered_area
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "info": null,
    "data": [
      {"key": "AD", "value": "安道尔"},
      {"key": "AE", "value": "阿联酋"},
      {"key": "AF", "value": "阿富汗"},        
    ]
}
```

###### 申请行业列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/get\_tt\_vertical

- Method：GET

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X GET \

https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/get_tt_vertical
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|key|int|id|
|value|string|value名|
|name|string|value名|
|child|list\<\>|子级|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "data": [
        {
            "key": 1,
            "value": "EC",
            "name": "EC",
            "child": [
                {
                    "key": 6,
                    "value": "消费类电子产品",
                    "name": "EC/消费类电子产品",
                    "child": [
                        {
                            "key": 290101,
                            "value": "消费类电子产品及周边",
                            "name": "EC/消费类电子产品/消费类电子产品及周边"
                        },
    
                    ]
                }
            ]
        }
    ],
    "info": null
}

```

##### TikTok东南亚美金

###### 营业执照上传

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/upload\_br

- Method：POST

- Content\-Type：multipart/form\-data

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|br\_file|file|Y|营业执照 / 资质文件，JPG、JPEG、PNG，不超过 10 MB|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -X POST \
--form 'br_file=@"/path/to/license.png"' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/upload_br
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|business\_registration|string|文件地址，用于开户申请的同名入参，同一主体可重复使用|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "business_registration": "https://xxx.myqcloud.com/ka_support_tt/1496a9c09560b241884ce5f07365e1cb.png"
    }
}
```

###### 开户申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/oa

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|entity\_name|string|Y|开户主体|
|industry|string|Y|行业全名，取「申请行业列表」三级节点的 name，最长255|
|industry\_id|int|Y|行业id，取「申请行业列表」三级节点的 key|
|account\_type|int|Y|1 竞价、2 品牌。品牌账户不可用于竞价投放，也无法充值|
|account\_num|int|Y|开户数量，1 \~ 50|
|timezone|string|Y|取「申请时区列表」的 value，最长100|
|timezone\_code|string|Y|取「申请时区列表」的 key，最长100|
|register\_area\_name|string|Y|取「申请注册地列表」的 value，最长100|
|register\_area\_code|string|Y|取「申请注册地列表」的 key，最长32|
|business\_registration|string|Y|「营业执照上传」返回的文件地址，最长255|
|business\_registration\_id|string|Y|营业执照编号，最长225|
|promotable\_urls|list\<string\>|Y|推广链接，非空数组|
|customer\_note|string|N|客户备注，最长225|
|unionpay\_verification\_required|string|register\_area\_code=CN 时必填|Yes / No，取值请先向蓝瀚AE确认|
|representative\_name|string|上一字段=Yes 时必填|法人姓名|
|representative\_id|string|上一字段=Yes 时必填|法人身份证号|
|unionpay\_account|string|上一字段=Yes 时必填|银联账号|
|representative\_phone\_number|string|上一字段=Yes 时必填|法人手机号|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "entity_name":"开户主体名称",
  "industry":"EC/零售&电商/综合类2B电商",
  "industry_id":292606,
  "account_type":1,
  "account_num":2,
  "timezone":"(UTC+07:00)亚洲/胡志明市-Asia/Ho_Chi_Minh",
  "timezone_code":"Asia/Ho_Chi_Minh",
  "register_area_name":"越南",
  "register_area_code":"VN",
  "business_registration":"https://xxx.myqcloud.com/ka_support_tt/1496a9c09560b241884ce5f07365e1cb.png",
  "business_registration_id":"0123456789",
  "promotable_urls":["https://www.example.com"],
  "customer_note":"备注"
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/oa
```

返回字段说明

> 本接口不返回申请ID，`data` 固定为 null。需要单号请调「开户列表」按开户主体 \+ 申请时间查询。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": null
}
```

常见失败原因

|info|原因|
|---|---|
|unionpay\_info need check|注册地为 CN 但未传 unionpay\_verification\_required|
|unionpay\_info empty check|unionpay\_verification\_required=Yes 但四个法人 / 银联字段未填全|
|客户签约不支持操作|当前签约为预付实销类型|
|数量最大为50 / 数量最小为1|account\_num 超出 1 \~ 50|
|发生未知错误|必填项缺失时的兜底文案，请逐项核对上表|

###### 开户列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/oa\_list

- Method：GET

- Header：同上（Authorization）

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|current\_page|int|1|N|当前页数，默认1|
|page\_size|int|10|N|每页条数，默认10|
|apply\_id|string|C266,C277|N|申请ID，逗号分隔，可带 C 前缀|
|account\_id|string|7184697481794617346|N|广告账户ID，逗号分隔|
|entity\_name|string|开户主体,开户主体1|N|开户主体，逗号分隔，模糊匹配|
|apply\_date|string|2026\-01\-04 00:13:07,2026\-01\-04 15:06:36|N|申请时间范围|
|status|string|2,4,6|N|开户状态，逗号分隔（见附录）|
|submitter|string|user@example\.com|N|提单人邮箱，精确匹配|

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "entity_name=开户主体名称" \
--data-urlencode "current_page=1" \
--data-urlencode "page_size=10" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/oa_list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|申请单主键ID，开户详情用此值|
|apply\_id|string|展示用单号，形如 C123|
|entity\_name|string|开户主体|
|account\_num|int|开户数量|
|account\_type|int|1 竞价、2 品牌|
|vertical|string|行业全名|
|industry\_id|int|行业id|
|timezone|string|时区|
|timezone\_code|string|时区code|
|register\_area|string|注册地|
|register\_area\_code|string|注册地code|
|promotable\_urls|list\<string\>|推广链接|
|business\_registration|string|营业执照文件地址|
|business\_registration\_id|string|营业执照编号|
|status|int|开户状态（见附录）|
|apply\_revoke|int|0 未撤回、1 已撤回|
|reason|string|驳回 / 失败原因，仅 status 为 3、5 时有值|
|customer\_note|string|客户备注|
|apply\_date|string|申请时间|
|team\_id|int|团队ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "list": [
            {
                "id": 123,
                "apply_id": "C123",
                "entity_name": "开户主体名称",
                "account_num": 2,
                "account_type": 1,
                "vertical": "EC/零售&电商/综合类2B电商",
                "industry_id": 292606,
                "timezone": "(UTC+07:00)亚洲/胡志明市-Asia/Ho_Chi_Minh",
                "timezone_code": "Asia/Ho_Chi_Minh",
                "register_area": "越南",
                "register_area_code": "VN",
                "promotable_urls": ["https://www.example.com"],
                "business_registration": "https://xxx.myqcloud.com/ka_support_tt/1496a9c09560b241884ce5f07365e1cb.png",
                "business_registration_id": "0123456789",
                "status": 4,
                "apply_revoke": 0,
                "reason": "",
                "customer_note": "备注",
                "apply_date": "2026-10-09 11:20:31",
                "team_id": 0
            }
        ],
        "pagination": {"page_size": 10, "page_nums": 1, "current_page": 1, "total": 1}
    }
}
```

###### 开户详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/oa\_detail/\{id\}

- Method：GET

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|id|int|Y|路径参数。开户列表返回的 id，裸数字不带 C|

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/oa_detail/123
```

返回字段说明

> 在「开户列表」字段基础上，额外返回：
> 
> 

|字段名|类型|说明|
|---|---|---|
|apply\_user|string|提单人邮箱|
|approval\_date|string \| null|审批通过时间|
|unionpay\_verification\_required|string|Yes / No / 空|
|accounts|list\<ACCOUNT\>|已下户成功的账户，下户失败的不在此列表|
|records|list\<RECORD\>|操作记录|
|fail\_reason|list\<string\>|下户失败原因|

ACCOUNT

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户ID|
|account\_name|string|账户名称|
|status|int|账户状态（见附录 3、TikTok 的「TikTok账户状态」）|
|rejection\_reason|string|驳回原因|

RECORD

|字段名|类型|说明|
|---|---|---|
|action|int|操作动作（见附录 3、TikTok 的「Tiktok操作记录状态」）|
|time|string|操作时间|
|user|string|操作人|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "id": 123,
        "apply_id": "C123",
        "entity_name": "开户主体名称",
        "apply_user": "user@example.com",
        "apply_date": "2026-10-09 11:20:31",
        "approval_date": "2026-10-09 14:02:10",
        "customer_note": "备注",
        "reason": "",
        "vertical": "EC/零售&电商/综合类2B电商",
        "industry_id": 292606,
        "account_type": 1,
        "account_num": 2,
        "timezone": "(UTC+07:00)亚洲/胡志明市-Asia/Ho_Chi_Minh",
        "timezone_code": "Asia/Ho_Chi_Minh",
        "promotable_urls": ["https://www.example.com"],
        "register_area": "越南",
        "register_area_code": "VN",
        "business_registration": "https://xxx.myqcloud.com/ka_support_tt/1496a9c09560b241884ce5f07365e1cb.png",
        "business_registration_id": "0123456789",
        "status": 6,
        "apply_revoke": 0,
        "unionpay_verification_required": "",
        "accounts": [
            {"account_id": "7184697481794617346", "account_name": "BV-Example-开户主体名称-123-1", "status": 59, "rejection_reason": ""}
        ],
        "records": [
            {"action": 1, "time": "2026-10-09 11:20:31", "user": "user@example.com"},
            {"action": 5, "time": "2026-10-09 14:02:10", "user": "ae@bluefocus.com"}
        ],
        "fail_reason": [],
        "team_id": 0
    }
}
```

###### 申请时区列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/timezone

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/timezone
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|key|string|用于开户申请的 timezone\_code|
|value|string|用于开户申请的 timezone|

> 完整取值见附录 3、TikTok 的「时区信息」。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {"key": "Asia/Ho_Chi_Minh", "value": "(UTC+07:00)亚洲/胡志明市-Asia/Ho_Chi_Minh"}
    ]
}
```

###### 申请注册地列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/registered\_area

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/registered_area
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|key|string|用于开户申请的 register\_area\_code|
|value|string|用于开户申请的 register\_area\_name|

> 返回全量注册地，东南亚各国与中国大陆、港澳排在前列。完整取值见附录 3、TikTok 的「地区代码」。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {"key": "CN", "value": "中国大陆"},
        {"key": "HK", "value": "中国香港"},
        {"key": "VN", "value": "越南"},
        {"key": "TH", "value": "泰国"},
        {"key": "ID", "value": "印度尼西亚"}
    ]
}
```

###### 申请行业列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/user\_open/tiktok\_sea\_usd/vertical

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/user_open/tiktok_sea_usd/vertical
```

返回字段说明

> 返回三级行业树，开户申请取第三级节点的值。
> 
> 

|字段名|类型|说明|
|---|---|---|
|key|int|行业id，三级节点的值用于 industry\_id|
|value|string|当级行业名|
|name|string|行业全名，三级节点形如「一级/二级/三级」，用于 industry|
|child|list|下级行业，三级无此字段|

> 完整取值见附录 3、TikTok 的「行业信息（三级分类）」。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {
            "key": 1,
            "value": "EC",
            "name": "EC",
            "child": [
                {
                    "key": 100,
                    "value": "零售&电商",
                    "name": "EC/零售&电商",
                    "child": [
                        {"key": 292606, "value": "综合类2B电商", "name": "EC/零售&电商/综合类2B电商"}
                    ]
                }
            ]
        }
    ]
}
```

###### 附录

开户状态（status）

|code|name|
|---|---|
|1|待补充信息|
|2|待审核|
|3|驳回|
|4|处理中|
|5|下户失败|
|6|已下户|

account\_type（账户类型）

|code|name|
|---|---|
|1|竞价 AUCTION|
|2|品牌 RESERVATION，不可用于竞价投放，无法充值|

apply\_revoke（是否撤回）

|code|name|
|---|---|
|0|未撤回|
|1|已撤回|

> 时区、地区代码、行业分类、广告账户状态、操作记录动作与 TikTok 共用同一套字典，取值见附录 3、TikTok。
> 
> 

##### Snapchat

###### 开户申请

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/snap_oa`

- Method：POST

- Content\-Type：application/json

- Header：

|字段|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|customer\_type|string|Y|客户类型（DS:电商 FDS:非电商）|
|self\_check\_info|dict|customer\_type=DS时必填|电商网站自检信息，key 见附录「自检项」，value 必须为 "NO"（表示未命中该风险项，自检通过）|
|industry|string|Y|行业类型（取值来自「Snapchat行业类型列表」接口）。格式须为「一级分类/二级分类」（如 EC/购物平台、EC/3C）或仅一级分类名（如 EC、Game、APP、Fintech、Branding），请勿只传二级分类名（如 3C）|
|timezone|string|Y|开户时区（取值来自「Snapchat时区列表」接口）|
|entity|string|Y|开户主体|
|launch\_country|list\<string\>|N|投放国家（取值来自「Snapchat投放国家列表」接口），默认为空|
|ios\_link|string|三者至少填一个|ios产品链接|
|android\_link|string|三者至少填一个|android产品链接|
|web\_link|string|三者至少填一个|web产品链接|
|product\_name|string|Y|产品名称（英文）|
|ad\_account\_number|int|N|开户数量，默认1，最大不超过5|
|open\_ad\_type|string|Y|开户方式（枚举：ZT、DT，见附录）|
|customer\_notes|string|N|客户备注|
|ae\_notes|string|N|AE备注|
|emails|list\<string\>|Y|授权邮箱列表|

> 以下字段由服务端根据登录账号自动注入，客户端**无需传递**：`sign_id`（签约ID）、`sale`（销售邮箱）、`ae`（负责AE邮箱）、`creator`（申请人邮箱）、`user_id`。若客户当前签约为"预付费消耗"类型，接口直接返回失败（`info: "客户签约不支持操作"`）。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "customer_type":"DS",
  "self_check_info":{"WEBSITE_LESS_3_MONTH":"NO","WEBSITE_INCOMPLETE":"NO","WEBSITE_MISMATCH":"NO","WEBSITE_TERMS_MISSING":"NO","WEBSITE_DECEPTIVE_CLAIMS":"NO","WEBSITE_SUSPECTED_IP_INFRINGEMENT":"NO","SELLING_ILLEGAL_PRODUCTS":"NO","WEBSITE_TYPOS":"NO","WEBSITE_404_ERROR":"NO","ABNORMAL_SELLING_PRICE":"NO","WEBSITE_NOT_REVIEWED":"NO"},
  "industry":"E-commerce",
  "timezone":"America/Los_Angeles",
  "entity":"开户主体名称",
  "launch_country":["US","CA"],
  "web_link":"https://www.example.com",
  "product_name":"ExampleProduct",
  "ad_account_number":1,
  "open_ad_type":"ZT",
  "customer_notes":"备注",
  "emails":["user@example.com"]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/snap_oa
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|本次开户申请的申请ID|

返回结果示例

```JSON
{
    "success": true,
    "data": {"apply_id": 412},
    "info": null,
    "code": null
}
```

---

###### 开户列表

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/snap_list`

- Method：**POST**（与 Google 用 GET\+querystring 不同，Snapchat 用 POST\+JSON body 传过滤参数）

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|current\_page|int|N|当前页数，默认1|
|page\_size|int|N|每页条数，默认10|
|apply\_ids|list\<int\>|N|按申请ID过滤|
|entitys|list\<string\>|N|按开户主体过滤|
|account\_ids|list\<string\>|N|按广告账户ID过滤|
|status|string|N|按开户状态过滤（见附录 apply\_status）|
|customer\_type|string|N|按客户类型过滤（DS/FDS）|
|start\_time|string|N|申请时间范围\-起|
|end\_time|string|N|申请时间范围\-止|

> 列表查询范围（`user_ids`）由平台按登录账号自动限定为"当前用户 \+ 同上级分组下的用户"，无需客户端传递。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"current_page":1,"page_size":10,"entitys":["开户主体名称"]}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/snap_list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|申请ID|
|sign\_id|int|签约信息ID|
|settlement|string|结算主体全称|
|entity|string|开户主体|
|our\_side\_entity|int|我方主体（枚举编号）|
|industry|string|行业类型|
|timezone|string|开户时区|
|ios\_link / android\_link / web\_link|string|产品链接|
|product\_name|string|产品名称|
|ad\_account\_number|int|开户数量|
|open\_ad\_type|string|开户方式（ZT/DT）|
|launch\_country|list\<string\>|投放国家|
|emails|list\<EMAIL\_INFO\>|授权邮箱信息，见下方 EMAIL\_INFO|
|sale / ae / creator|string|销售 / 负责AE / 申请人邮箱|
|create\_time / apply\_date|string|创建（申请）时间，两字段同值|
|approver / approve\_time|string|审批人 / 审批时间|
|ae\_notes / customer\_notes|string|AE备注 / 客户备注|
|status|string|开户状态（见附录 apply\_status）|
|data\_source|int|数据来源（见附录）|
|self\_check\_info|string|自检信息（JSON字符串）|
|is\_urgent|int|是否加急：1未加急 2已加急|
|is\_revoke|int|是否撤回：1未撤回 2已撤回|
|customer\_type|string|客户类型（DS/FDS）|
|reason|string|驳回/撤回原因|

**EMAIL\_INFO**

|字段名|类型|说明|
|---|---|---|
|email|string|邮箱地址|
|member\_status|string|邀请成员状态（见附录）|

返回结果示例

```JSON
{
    "success": true,
    "data": {
        "list": [
            {
                "id": 412,
                "settlement": "结算主体全称",
                "entity": "开户主体名称",
                "our_side_entity": 0,
                "industry": "E-commerce",
                "timezone": "America/Los_Angeles",
                "ios_link": "",
                "android_link": "",
                "web_link": "https://www.example.com",
                "product_name": "ExampleProduct",
                "ad_account_number": 1,
                "open_ad_type": "ZT",
                "launch_country": ["US", "CA"],
                "emails": [{"email": "user@example.com", "member_status": "NOT_INVITED"}],
                "sale": "sale@domob.cn",
                "ae": "ae@domob.cn",
                "creator": "lizhen@domob.cn",
                "create_time": "2026-01-04T16:42:17",
                "apply_date": "2026-01-04T16:42:17",
                "approver": "",
                "approve_time": null,
                "ae_notes": "",
                "customer_notes": "备注",
                "status": "INIT",
                "data_source": 0,
                "self_check_info": "{...}",
                "is_urgent": 1,
                "is_revoke": 1,
                "customer_type": "DS",
                "reason": ""
            }
        ],
        "pagination": {"current_page": 1, "page_size": 10, "total": 1, "page_nums": 1}
    },
    "info": null,
    "code": null
}
```

---

###### 开户详情

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/snap_list/{id}`

- Method：GET

- Header：同上（Authorization）

`{id}` 即申请ID（对应列表中的 `id`）。

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/snap_list/412
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|entity\_info|ENTITY\_INFO|申请基础信息（等于列表接口单条记录的全部字段，额外融合了详情专属字段）|
|account\_info|list\<ACCOUNT\>|已开通的广告账户信息|
|records|list\<RECORD\>|操作/审批记录|

**ENTITY\_INFO**：包含「开户列表」返回字段中的全部内容（entity/status/timezone/industry/apply\_date 等），另外 `self_check_info` 在详情接口中会被解析为 JSON 对象（列表接口中是 JSON 字符串）。

**ACCOUNT**

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户ID|
|account\_name|string|账户名称|
|status|string|账户状态|
|emails|list\<string\>|该账户已分配/邀请的邮箱|

**RECORD**

|字段名|类型|说明|
|---|---|---|
|action|string|操作记录类型|
|create\_time|string|操作时间|
|operater|string|操作人。当 action 为 REJECT（驳回）或 APPROVED（通过）时，固定展示为 "蓝标"|

返回结果示例

```JSON
{
    "success": true,
    "data": {
        "entity_info": {
            "entity": "开户主体名称",
            "creator": "lizhen@domob.cn",
            "create_time": "2026-01-04T16:42:17",
            "id": 412,
            "approve_time": null,
            "customer_notes": "备注",
            "self_check_info": {"WEBSITE_LESS_3_MONTH": "NO"},
            "customer_type": "DS",
            "sign_id": 123,
            "status": "INIT",
            "apply_date": "2026-01-04T16:42:17"
        },
        "account_info": [],
        "records": [
            {"action": "APPLY", "create_time": "2026-01-04T16:42:17", "operater": "lizhen@domob.cn"}
        ]
    },
    "info": null,
    "code": null
}
```

---

###### 申请撤回

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/oa_revoke`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|ids|list\<int\>|Y|待撤回的申请ID列表（注意字段名为 ids，与 Google 侧的 id 不同）|
|reason|string|Y|撤回原因|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"ids":[412],"reason":"客户主动撤回"}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/oa_revoke
```

返回结果示例

```JSON
{
    "success": true,
    "data": null,
    "info": null,
    "code": null
}
```

---

###### 时区列表

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/timezone`

- Method：GET

- Header：同上（Authorization）

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/timezone
```

返回结果示例

```JSON
{
    "success": true,
    "data": [],
    "info": null,
    "code": null
}
```

> 该数据实时来自下游 Snapchat 开户服务（非本地数据表），代码层面未对字段做二次加工，具体字段结构（是否与 Google 的 `{"value":..,"key":..}` 一致）需以实际调用结果为准。
> 
> 

---

###### 行业类型列表

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/industry`

- Method：GET

- Header：同上（Authorization）

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/industry
```

返回字段说明

二级分类结构，按当前语言环境返回对应语言的名称。

|字段名|类型|说明|
|---|---|---|
|name|string|一级行业名称|
|children|list\<\{name\}\>|二级行业名称列表|

返回结果示例

```JSON
{
    "success": true,
    "data": [
        {"name": "电子商务", "children": [{"name": "服饰"}, {"name": "3C数码"}]}
    ],
    "info": null,
    "code": null
}
```

---

###### 投放国家列表

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/launch_country`

- Method：GET

- Header：同上（Authorization）

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/launch_country
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|code|string|国家代码|
|name|string|国家名称（按当前语言环境返回）|

返回结果示例

```JSON
{
    "success": true,
    "data": [
        {"code": "US", "name": "美国"},
        {"code": "CA", "name": "加拿大"}
    ],
    "info": null,
    "code": null
}
```

---

###### 账户分配成员

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/assign_account`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|apply\_id|int|Y|开户申请ID|
|account\_ids|list\<string\>|Y|待分配的广告账户ID列表|
|emails|list\<string\>|Y|授权邮箱列表|

> `account_role`（成员权限）由服务端固定分配为 `3`（general），客户端无法指定其他角色。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"apply_id":412,"account_ids":["454-568-8539"],"emails":["user@example.com"]}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/assign_account
```

返回结果示例

```JSON
{
    "success": true,
    "data": null,
    "info": null,
    "code": null
}
```

---

###### 成员邀请

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/member_invite`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|apply\_id|int|Y|开户申请ID|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"apply_id":412}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/member_invite
```

返回结果示例

```JSON
{
    "success": true,
    "data": null,
    "info": null,
    "code": null
}
```

---

###### 成员邀请详情（重置失效邀请）

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/member_invite_detail`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|apply\_id|int|Y|开户申请ID|
|email|string|Y|需重置邀请状态的邮箱|

说明

该接口用于将指定申请下、指定邮箱的邀请记录由"已失效（`INVALID`）"重置为"未发送邀请（`NOT_INVITED`）"，便于重新发起邀请。若申请已撤回（`is_revoke=2`）、审核驳回（`audit_status=DISAPPROVED`）或开户失败（`apply_status=FAILED`），则不允许操作，返回 `info: "申请已不支持操作"`。该接口直接读写本地表，不调用下游thrift服务。

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"apply_id":412,"email":"user@example.com"}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/snap/member_invite_detail
```

返回结果示例

```JSON
{
    "success": true,
    "data": null,
    "info": null,
    "code": null
}
```

---

###### 附录（snapchat）

**customer\_type（客户类型）**

- `DS`：电商

- `FDS`：非电商

**open\_ad\_type（开户方式）**

- `ZT`：自投

- `DT` ：代投 （具体业务含义以产品定义为准）

**self\_check\_info 自检项（customer\_type=DS 时必填，value 须为 ****`"NO"`**** 才算通过自检）**

|key|说明|
|---|---|
|WEBSITE\_LESS\_3\_MONTH|网站上线不满3个月|
|WEBSITE\_INCOMPLETE|网站信息不完整|
|WEBSITE\_MISMATCH|网站与业务不匹配|
|WEBSITE\_TERMS\_MISSING|网站缺少条款/协议|
|WEBSITE\_DECEPTIVE\_CLAIMS|网站存在虚假宣传|
|WEBSITE\_SUSPECTED\_IP\_INFRINGEMENT|疑似侵犯知识产权|
|SELLING\_ILLEGAL\_PRODUCTS|销售违规商品|
|WEBSITE\_TYPOS|网站存在明显错别字|
|WEBSITE\_404\_ERROR|网站存在404错误|
|ABNORMAL\_SELLING\_PRICE|售价异常|
|WEBSITE\_NOT\_REVIEWED|网站未经审核|

**apply\_status（开户状态）**

- `INIT`：初始化

- `OPENING`：开户中

- `SUCCESS`：开户成功

- `FAILED`：开户失败

**audit\_status（开户审核状态，本地表字段，用于成员邀请详情接口的前置校验）**

- `AUDITING`：待审核

- `APPROVED`：商务审核通过

- `DISAPPROVED`：审核驳回

**member\_status（邀请成员状态）**

- `NOT_INVITED`：未发送邀请

- `INVITED`：已发送邀请，未加入org

- `JOINED`：已接受邀请，加入org（角色为member）

- `INVALID`：邀请过期失效（仅本地成员分配记录使用）

**is\_revoke（是否撤回）**

- `1`：未撤回

- `2`：已撤回

**is\_urgent（是否加急）**

- `1`：未加急

- `2`：已加急

**data\_source（数据来源）**

- `0`：账户管理平台

- `1`：BV\_CRM

- `2`：Vision Line

- `3`：异步任务

- `4`：自动创建申请

**account\_role（成员权限，内部固定值，对外「账户分配成员」接口目前固定传 ****`3`****）**

- `1`：admin

- `2`：creative

- `3`：general

- `4`：reports

- `5`：audience

##### open\-ai

###### 账户头像上传

> 上传后返回的 favicon\_url 用于「开户申请」「品牌信息返工」接口的同名字段。头像会展示在 open\-ai 广告旁，并参与 open\-ai 侧的品牌审核。
> 
> 文件要求：仅支持图片格式（PNG / JPG / JPEG），格式按文件内容判定，修改扩展名无效；宽高比须为 1:1；宽、高均不小于 256 像素；文件大小不超过 5 MB。
> 
> 

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/upload\_favicon

- Method：POST

- Content\-Type：multipart/form\-data

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|file|file|二者传其一|图标文件，png / jpg / jpeg，宽高比 1:1，不小于 256×256，不超过 5 MB|
|files|file\[\]|二者传其一|图标文件数组，只取第一个|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -X POST \
--form 'file=@"/path/to/favicon.png"' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/upload_favicon
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|favicon\_url|string|图标地址，用于开户申请的同名入参|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"favicon_url": "https://xxx.com/ka_support_openai/favicon_a1b2c3d4.png"}
}
```

###### 开户申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/openai\_oa

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|entity|string|Y|开户主体|
|industry|string|Y|取「行业类型列表」的 name|
|account\_name|string|Y|广告账号名称|
|web\_link|string|Y|官网地址，须以 http:// 或 https:// 开头|
|currency|int|Y|币种数字枚举，取「币种列表」的 code。当前仅支持 0（USD）|
|timezone|string|Y|IANA 格式，取「时区列表」的值。建号后不可改|
|favicon\_url|string|Y|「账户头像上传」返回的地址|
|open\_ad\_type|string|Y|ZT 自投、DT 代投|
|customer\_type|string|N|DS 电商、FDS 非电商|
|self\_check\_info|dict|N|自检信息，不校验键值|
|product\_name|string|N|产品名称|
|launch\_country|list\<string\>|N|取「投放国家列表」的 code，仅作记录，不参与开户|
|description|string|N|产品 / 业务描述|
|ios\_link|string|N|iOS 应用链接|
|android\_link|string|N|安卓应用链接|
|customer\_notes|string|N|客户备注|

> 开户数量固定为 1。签约、销售、AE、申请人由平台按登录账号注入，无需传递。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "entity":"开户主体名称",
  "industry":"EC",
  "account_name":"BV-Example-AdAccount-01",
  "web_link":"https://www.example.com",
  "currency":0,
  "timezone":"Asia/Shanghai",
  "favicon_url":"https://xxx.com/ka_support_openai/favicon_a1b2c3d4.png",
  "open_ad_type":"ZT",
  "customer_type":"DS",
  "product_name":"ExampleProduct",
  "launch_country":["US","CA"],
  "customer_notes":"备注"
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/openai_oa
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|申请ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"apply_id": 123}
}
```

常见失败原因

|info|原因|
|---|---|
|客户签约不支持操作|当前签约为预付实销类型|
|未获取到您的签约信息，请联系AE|当前账号未关联签约|
|币种 XXX 不在预配置范围 \[\.\.\.\] 内|该币种尚未对 open\-ai 开通，当前仅支持 USD|
|账户时区需为 IANA 格式…|timezone 格式不符|

###### 开户列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/openai\_list

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

全部选填。

|参数|类型|是否必填|说明|
|---|---|---|---|
|current\_page|int|N|当前页数，默认1|
|page\_size|int|N|每页条数，默认10|
|apply\_ids|list\<int\>|N|申请ID，必须传数组|
|entitys|list\<string\>|N|开户主体|
|settlements|list\<string\>|N|结算主体|
|account\_ids|list\<string\>|N|广告账户ID|
|aes|list\<string\>|N|负责AE邮箱|
|sales|list\<string\>|N|销售邮箱|
|audit\_status|list\<string\>|N|内部审核状态（见附录）|
|apply\_status|list\<string\>|N|开户状态（见附录）|
|open\_status|list\<string\>|N|开户进度状态（见附录）|
|customer\_type|string|N|DS / FDS|
|is\_urgent|int|N|1 未加急、2 已加急|
|is\_revoke|int|N|1 未撤回、2 已撤回|
|start\_time|string|N|申请时间范围\-起|
|end\_time|string|N|申请时间范围\-止|

> 上表 8 个 list\<string\> 字段兼容单值，传 "OPENING" 等价于 \["OPENING"\]；apply\_ids 不兼容单值。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"current_page":1,"page_size":10,"open_status":"OPENING"}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/openai_list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|申请ID|
|sign\_id|int|签约ID|
|settlement|string|结算主体|
|entity|string|开户主体|
|account\_name|string|广告账号名称|
|our\_side\_entity|int|我方主体|
|industry|string|行业类型|
|currency|int|币种数字枚举（见附录）|
|timezone|string|账户时区|
|favicon\_url|string|账户头像地址|
|web\_link|string|官网地址|
|description|string|产品 / 业务描述|
|ios\_link / android\_link|string|产品链接|
|product\_name|string|产品名称|
|ad\_account\_number|int|开户数量，恒为1|
|open\_ad\_type|string|ZT / DT|
|launch\_country|list\<string\>|推广国家|
|sale / ae / creator|string|销售 / 负责AE / 申请人邮箱|
|create\_time|string|申请时间|
|approver / approve\_time|string|审批人 / 审批时间|
|ae\_notes / customer\_notes|string|AE备注 / 客户备注|
|audit\_status|string|内部审核状态（见附录）|
|apply\_status|string|开户状态（见附录）|
|open\_status|string|开户进度状态（见附录），判断进度用此字段|
|open\_status\_text|string|开户进度中文文案，可直接展示|
|data\_source|int|数据来源|
|self\_check\_info|dict \| null|自检信息|
|is\_urgent|int|1 未加急、2 已加急|
|is\_revoke|int|1 未撤回、2 已撤回|
|customer\_type|string|DS / FDS|
|reason|string|驳回 / 撤回原因|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "list": [
            {
                "id": 123,
                "sign_id": 4567,
                "settlement": "结算主体全称",
                "entity": "开户主体名称",
                "account_name": "BV-Example-AdAccount-01",
                "our_side_entity": 1,
                "industry": "EC",
                "currency": 0,
                "timezone": "Asia/Shanghai",
                "favicon_url": "https://xxx.com/ka_support_openai/favicon_a1b2c3d4.png",
                "web_link": "https://www.example.com",
                "description": "跨境电商独立站",
                "ios_link": "",
                "android_link": "",
                "product_name": "ExampleProduct",
                "ad_account_number": 1,
                "open_ad_type": "ZT",
                "launch_country": ["US", "CA"],
                "sale": "sale@bluefocus.com",
                "ae": "ae@bluefocus.com",
                "creator": "user@example.com",
                "create_time": "2026-10-09 11:20:31",
                "approver": "",
                "approve_time": "",
                "ae_notes": "",
                "customer_notes": "备注",
                "audit_status": "AUDITING",
                "apply_status": "INIT",
                "open_status": "INTERNAL_AUDITING",
                "open_status_text": "蓝标审核中",
                "data_source": 2,
                "self_check_info": null,
                "is_urgent": 1,
                "is_revoke": 1,
                "customer_type": "DS",
                "reason": ""
            }
        ],
        "pagination": {"current_page": 1, "page_size": 10, "total": 1, "page_nums": 1}
    }
}
```

###### 开户详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/openai\_list/\{apply\_id\}

- Method：GET

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|apply\_id|int|Y|路径参数，申请ID|

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/openai_list/123
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|entity\_info|dict|申请单信息，字段同「开户列表」，其中 self\_check\_info 解析为 JSON 对象|
|account\_info|list\<ACCOUNT\>|已下户的广告账户，未成功下户时为空数组|
|records|list\<RECORD\>|操作记录|

ACCOUNT

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户ID|
|account\_name|string|账户名称|
|seq|int|下户序号|
|open\_step|string|下户流程步骤|
|account\_status|string|媒体侧账户状态（见附录）|
|brand\_review\_status|string|品牌审核状态（见附录）|
|brand\_review\_reason|string|品牌审核驳回原因|
|brand\_review\_screenshot|string|驳回截图|
|integrity\_review\_status|string|诚信审核状态|
|preview\_url|string|预览链接|
|servable|bool|是否可投放，判断能否投放请用此字段|
|fail\_step / fail\_reason|string|失败步骤 / 原因|

RECORD

|字段名|类型|说明|
|---|---|---|
|action|string|操作动作|
|create\_time|string|操作时间|
|operater|string|操作人|
|notes|string|备注|

> 账户重审期间 account\_status 仍为 Active，仅凭该字段看不出账户不可投放。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "entity_info": {
            "id": 123,
            "entity": "开户主体名称",
            "account_name": "BV-Example-AdAccount-01",
            "currency": 0,
            "timezone": "Asia/Shanghai",
            "favicon_url": "https://xxx.com/ka_support_openai/favicon_a1b2c3d4.png",
            "web_link": "https://www.example.com",
            "industry": "EC",
            "open_ad_type": "ZT",
            "ad_account_number": 1,
            "description": "跨境电商独立站",
            "customer_type": "DS",
            "sign_id": 4567,
            "creator": "user@example.com",
            "create_time": "2026-10-09 11:20:31",
            "approver": "ae@bluefocus.com",
            "approve_time": "2026-10-09 14:02:10",
            "customer_notes": "备注",
            "self_check_info": null,
            "open_status": "MEDIA_REVIEWING",
            "open_status_text": "媒体审核中"
        },
        "account_info": [
            {
                "account_id": "act_1234567890",
                "account_name": "BV-Example-AdAccount-01",
                "seq": 1,
                "open_step": "BRAND_BOUND",
                "account_status": "Paused",
                "brand_review_status": "in_review",
                "brand_review_reason": "",
                "brand_review_screenshot": "",
                "integrity_review_status": "in_review",
                "preview_url": "",
                "servable": false,
                "fail_step": "",
                "fail_reason": ""
            }
        ],
        "records": [
            {"action": "创建申请", "create_time": "2026-10-09 11:20:31", "operater": "user@example.com", "notes": ""}
        ]
    }
}
```

###### 申请撤回

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/oa\_revoke

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|ids|list\<int\>|Y|申请ID列表|
|reason|string|N|撤回原因|

> 已开户成功的申请不允许撤回。列表中任一申请不属于当前账号时整个请求失败。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"ids":[123],"reason":"信息填错，重新提交"}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/oa_revoke
```

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": null
}
```

###### 品牌信息返工

> 用于品牌审核被驳回（brand\_review\_status=rejected）后修改头像 / 官网 / 广告账号名并重新送审。修改任意一项都会触发 open\-ai 侧重新审核，审核期间账户不可投放。
> 
> 

> **open\-ai 账号名只能通过本接口修改，通用的「新兴媒体更名申请」对 open\-ai 不开放。**
> 
> 

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/update\_brand

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|apply\_id|int|Y|申请ID|
|account\_id|string|Y|要修改的广告账户ID|
|favicon\_url|string|三者至少填一个|新头像地址|
|web\_link|string|三者至少填一个|新官网地址，须以 http:// 或 https:// 开头|
|account\_name|string|三者至少填一个|新广告账号名，不超过255字符|
|notes|string|N|备注|

> 空值表示本项不改。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "apply_id":123,
  "account_id":"act_1234567890",
  "favicon_url":"https://xxx.com/ka_support_openai/favicon_e5f6a7b8.png",
  "notes":"按驳回意见更换头像"
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/update_brand
```

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": null
}
```

###### 时区列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/timezone

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/timezone
```

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {"name": "Asia/Shanghai"},
        {"name": "America/New_York"}
    ]
}
```

###### 行业类型列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/industry

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/industry
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|name|string|行业名称，用于开户申请的 industry|
|name\_en|string|行业英文名|

> 一级扁平结构，共 5 条。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {"name": "Game", "name_en": "Game"},
        {"name": "APP", "name_en": "APP"},
        {"name": "EC", "name_en": "EC"},
        {"name": "Fin", "name_en": "Fin"},
        {"name": "Branding", "name_en": "Branding"}
    ]
}
```

###### 投放国家列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/launch\_country

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/launch_country
```

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {"code": "US", "name": "United States"},
        {"code": "CA", "name": "Canada"}
    ]
}
```

###### 币种列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/openai/currency

- Method：GET

- Header：同上（Authorization）

请求参数

无

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/openai/currency
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|code|int|币种数字枚举，用于开户申请的 currency|
|name|string|币种中文名|
|iso|string|ISO 4217 代码|

> 返回平台支持的币种全集，open\-ai 当前仅开通 USD。币种建号后不可改。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": [
        {"code": 0, "name": "美元", "iso": "USD"}
    ]
}
```

###### 附录

> currency（币种，开户申请传 code）
> 
> 

|code|ISO|中文|
|---|---|---|
|0|USD|美元|
|1|HKD|港币|
|2|CNY|人民币|
|3|ARP|阿根廷比索|
|4|JPY|日元|

> 当前 open\-ai 仅开通 0（USD）。
> 
> 

open\_ad\_type（开户方式）

|code|name|
|---|---|
|ZT|自投|
|DT|代投|

customer\_type（客户类型）

|code|name|
|---|---|
|DS|电商|
|FDS|非电商|

open\_status（开户进度状态）

|code|name|
|---|---|
|REVOKED|已撤回|
|INTERNAL\_REJECTED|蓝标驳回|
|INTERNAL\_AUDITING|蓝标审核中|
|OPENING|开户处理中|
|MEDIA\_REVIEWING|媒体审核中|
|MEDIA\_REJECTED|媒体驳回，需走品牌信息返工|
|FAILED|开户失败|
|COMPLETED|开户完成，可投放|

audit\_status（内部审核状态）

|code|name|
|---|---|
|AUDITING|审核中|
|APPROVED|审核通过|
|DISAPPROVED|审核驳回|

apply\_status（开户状态）

|code|name|
|---|---|
|INIT|初始|
|OPENING|开户中|
|SUCCESS|开户成功|
|PART\_SUCCESS|部分成功|
|FAILED|开户失败|

account\_status（媒体侧账户状态）

|code|name|
|---|---|
|Active|活跃，可充值|
|Paused|暂停，不可充值。新账户在品牌 \+ 诚信双审通过前恒为此状态|
|Unknown|状态未知，不可充值|

brand\_review\_status（品牌审核状态）

|code|name|
|---|---|
|in\_review|审核中|
|approved|审核通过|
|rejected|审核驳回，需走品牌信息返工|



---



#### 账户管理

|接口|说明|
|---|---|
|facebook账户查询|支持查询facebook广告账户的信息|
|google账户查询|支持查询google广告账户的信息|
|tiktok账户查询|支持查询tiktok广告账户的信息|
|其他媒体需求查询|支持查询小媒体申请信息的查询|
|其他媒体需求详情|支持查看单个媒体需求详情|
|需求申请记录查询 |支持查询facebook、google、tiktok申请信息的查询|
|facebook额度变更|facebook充值、减款、清零申请|
|facebook绑定bm|facebook 绑定 解邦bm申请|
|facebook绑定pixel|facebook 绑定 解邦pixel申请|
|facebook更名|facebook修改账户名称申请|
|google额度变更|google充值、减款、清零申请|
|google授权个人账户|google绑定、解绑邮箱申请|
|google接受mcc邀请|google接受、拒绝、移除mcc申请|
|google更名|google账户修改名称申请|
|tiktok额度变更|tiktok充值、减款、清零申请|
|tiktok绑定bc\_id|tiktok账户绑定、解绑bc\_id申请|
|tiktok绑定邮箱|tiktok账户绑定、解绑邮箱|
|新兴媒体申请额度管理|新兴媒体充值、减款、清零申请|
|新兴媒体申请绑定|新兴媒体绑定申请|
|新兴媒体申请账户更名|新兴媒体申请账户更改名称申请|
|新兴媒体申请其他|新兴媒体申请其他申请|

##### facebook账户列表

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/facebook/list

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|request\_id|string|1356369788463676,1356369788463677|N|支持facebook request\_id查询|
|entity\_name|string|北京开户主体,北京开户主体1|N|支持开户主体的查询|
|account\_id|string|7184631835685601281,7184632277400436738|N|支持账户id的查询|
|apply\_date|string|2023\-01\-04 00:13:07,2023\-01\-04 15:06:36|N|支持申请时间查询|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "request_id=1356369788463676,1356369788463677" \
--data-urlencode "entity_name=北京开户主体,北京开户主体1" \
--data-urlencode "account_id=7184631835685601281,7184632277400436738" \
--data-urlencode "apply_date=2023-01-04 00:13:07,2023-01-04 15:06:36" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/facebook/list
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户id|
|**status**|int|账户状态 [**账户状态 枚举值**](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#part-X2fYdc8PmoZ1jrxkYRocbOk6nhf)|
|entity\_name|string|开户主体|
|vertical|string|行业类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#By4AdG8YGoKWCaxKy7yci3nQngf)）|
|promotable\_page\_ids|list\<string\>|粉丝页|
|official\_website\_url|list\<string\>|Official Website Url|
|promotable\_urls|list\<string\>|promotable\_urls|
|promotable\_app\_ids|list\<string\>|推广App Ids|
|apply\_date|string|申请开户时间|
|request\_id|string|request\_id|
|id|int|唯一id|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "id": 104029,
                "entity_name": "北京汉迪移动互联网科技股份有限公司",
                "account_id": "392759554778017",
                "request_id": null,
                "vertical": "EC",
                "apply_date": null,
                "promotable_page_ids": null,
                "official_website_url": null,
                "promotable_urls": null,
                "promotable_app_ids": null
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code": 0
}

```



##### facebook账户清零查询（币种都是USD）

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/facebook/get\_account\_clear\_record

- Method：POST

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|account\_ids|list\<string\><br>|\[7184631835685601281,7184632277400436738\]|Y|facebook账户id的查询<br>|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d "account_ids":["123123", "132131"]
\
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/facebook/get_account_clear_record
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户id|
|account\_clear\_records|list\<string\>|返回实体|

account\_clear\_records

|字段名|类型|说明|
|---|---|---|
|clear\_date|string|清零时间|
|clear\_spend\_cap|string|请零前金额|
|clear\_amount\_spent|string|清零前消耗|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "code": 0,
    "data": [
        {
            "account_id": "440576444762856",
            "account_clear_records": [
                {
                    "clear_date": "2023-03-13T15:21:05+08:00",
                    "clear_spend_cap": "2950.01",
                    "clear_amount_spent": "232.09"
                },
                {
                    "clear_date": "2023-02-09T20:28:18+08:00",
                    "clear_spend_cap": "5000.01",
                    "clear_amount_spent": "3874.67"
                },
                {
                    "clear_date": "2023-01-05T16:28:19+08:00",
                    "clear_spend_cap": "6000.01",
                    "clear_amount_spent": "4713.07"
                },
                {
                    "clear_date": "2022-12-16T14:19:26+08:00",
                    "clear_spend_cap": "2000.01",
                    "clear_amount_spent": "0.00"
                }
            ]
        }
    ],
    "info": null
}


```

##### google账户查询

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/google/list

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|customer\_subject|string|北京开户主体,北京开户主体1|N|支持开户主体的查询|
|account\_id|string|718\-463\-1835，685\-601\-2810|N|支持账户id的查询|
|product\_url|string|www\.jd\.com,www\.baidu\.com|N|支持产品链接查询|
|apply\_date|string|2023\-01\-04 00:13:07,2023\-01\-04 15:06:36|N|支持申请时间查询|
|status|int|600|N|支持广告账户状态查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#V8audPor6oe4gVxezdRcYRlanbg)）|
|industry\_type|int|1,2,3|N|支持行业类型查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnvq4SNE6DFThPERdpvDJyic)）|
|currency|int|1,2,3|N|支持币种查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#YSwod2aieoeU6WxQpHoc6D1gnMf)）|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "customer_subject=北京开户主体,北京开户主体1" \
--data-urlencode "account_id=718-463-1835，685-601-2810" \
--data-urlencode "product_url=www.jd.com,www.baidu.com" \
--data-urlencode "industry_type=1,2,3" \
--data-urlencode "currency=1,2,3" \
--data-urlencode "apply_date=2023-01-04 00:13:07,2023-01-04 15:06:36" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/google/list
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户id|
|customer\_subject|string|客户开户主体|
|account\_name|string|广告账户名称|
|apply\_status|int|账户状态|
|currency|int|币种|
|industry\_type|int|行业类型|
|product\_url|list\<string\>|产品链接|
|apply\_date|string|申请开户时间|
|id|int|账户主键id|
|apply\_id|int|申请id|
|throw\_area|list\<int\>|投放地区（0:法国和匈牙利、1:中国大陆和中国香港、2:其他）|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "id": 157,
                "customer_subject": "测试33333",
                "account_id": "4356868188",
                "account_name": null,
                "apply_id": 245,
                "industry_type": 0,
                "currency": 1,
                "apply_status": 3,
                "apply_date": "2021-08-12T03:46:39+08:00",
                "product_url": [
                    "324234"
                ],
                "throw_area": [
                    "2",
                    "1"
                ]
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code": 0
}


```

##### tiktok账户查询

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/tiktok/list

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|entity\_name|string|北京开户主体,北京开户主体1|N|支持开户主体的查询|
|account\_id|string|7184697481794617346，7184697481794617346|N|支持账户id的查询|
|apply\_id|string|4064,4605|N|支持申请id查询|
|apply\_date|string|2023\-01\-04 00:13:07,2023\-01\-04 15:06:36|N|支持申请时间查询|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "entity_name=北京开户主体,北京开户主体1" \
--data-urlencode "account_id=718-463-1835，685-601-2810" \
--data-urlencode "apply_id=4064,4605" \
--data-urlencode "apply_date=2023-01-04 00:13:07,2023-01-04 15:06:36" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok/list
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|account\_id|string|广告账户id|
|entity\_name|string|客户开户主体|
|account\_name|string|广告账户名称|
|account\_type|int|账户类型|
|apply\_id|int|申请id|
|id|int|id|
|promotable\_urls|list\<string\>|投放链接|
|timezone|string|时区|
|vertical|int|行业|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "success": true,
    "data": {
        "list": [
            {
                "id": 278733,
                "entity_name": "郑州翎购信息科技有限公司",
                "account_id": "7184697481794617346",
                "account_name": "BV-LJ-Lucky Ecommerce limited-郑州翎购信息科技有限公司-4064-1",
                "account_type": 1,
                "apply_id": 4064,
                "vertical": 1,
                "promotable_urls": [
                    "https://auicany.com"
                ],
                "timezone": "(UTC+08:00)亚洲/北京-Asia/Shanghai"
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code":0
}



```

##### 新兴媒体账户需求列表

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/small\_medium/list

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|account\_id|string|123456fwer,123213123|N|支持账户id的查询|
|apply\_id|string|C222030,C4605|N|支持申请id查询|
|medium|string|48,49,50|N|支持小媒体类型查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#Ou6SdoqOyo6S6Oxcragc49nfnmg)）|
|apply\_type|string|0,1,2,3|N|支持申请类型查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#PiuId0Q8mo8WeqxOWqWcUTRrnjf)）|
|apply\_status|string|0,1,2,3|N|支持申请状态查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#Ya2IdEeaIowKQmxI3x8cXMuxnOg)）|
|account\_type|int|1|N|支持账户类型查询（0:非游戏 1:游戏）|
|current\_page|int|1|Y|当前页数|
|page\_size|int|1000|Y|每页页数|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "account_id=718-463-1835，685-601-2810" \
--data-urlencode "apply_id=C222030,C4605" \
--data-urlencode "medium=21,22,23" \
--data-urlencode "apply_type=0,1,2,3" \
--data-urlencode "apply_status=0,1,2,3" \
--data-urlencode "account_type=1" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/small_medium/list
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|string|申请id|
|apply\_type|int|申请类型|
|account\_type|int|账户类型|
|medium|int|小媒体类型|
|total\_amount|string|充值金额合计|
|apply\_user|string|申请人|
|apply\_time|string|申请时间|
|apply\_status|int|申请状态|
|feedback|string|备注|
|id|int|申请id|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "id": 222030,
                "apply_id": "C222030",
                "medium": 20,
                "apply_type": 0,
                "apply_status": 2,
                "account_type": 0,
                "apply_user": "lizhen@domob.cn",
                "total_amount": 0.2,
                "feedback": null,
                "apply_time": "2022-09-09T16:36:10.381220+08:00"
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code": 0
}
```

##### 新兴媒体账户需求详情

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/small\_medium/list/\{id\}

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数



请求示例

```PowerShell
curl --get -H "Authorization:Bearer xxx" \

https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/small_medium/list/123456
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|applications|list\<APPLICATION\>|申请返回数据|
|records|list\<RECORDS\>|申请记录返回数据|

APPLICATION

|字段名|类型|说明|
|---|---|---|
|account\_id|string|账户id|
|account\_name|string|账户名称|
|charge\_amount|float|金额（充值）|
|charge\_type|int|充值类型（1:充值、 2:减款、 3:清零）（充值）|
|notes|string|备注|
|reason|string|失败原因|
|status|int|申请状态（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#Ya2IdEeaIowKQmxI3x8cXMuxnOg)）|
|bind\_type|int|绑定类型（1:绑定、2:解绑）（绑定）|
|bind\_content|string|绑定内容（绑定）|
|new\_account\_name|string|更名（更名）|
|content|string|需求内容（其他）|

RECORDS（略）





返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "applications": [
            {
                "account_id": "an;wv",
                "content": "a;mvwqve",
                "notes": "vcwvew",
                "status": 0,
                "reason": null
            },
            {
                "account_id": "n;mnva",
                "content": "ncva;onv;lwqe",
                "notes": "can;vn;",
                "status": 0,
                "reason": null
            }
        ],
        "records": [
            {
                "id": 443961,
                "action": 1,
                "owner": "lizhen@domob.cn",
                "by_batch": 0,
                "time": "2022-08-25 10:01:42"
            }
        ]
    },
    "info": null,
    "code": 0
}

```

##### 大媒体账户管理需求申请记录

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/operate\_record

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|category|int|1|Y|支持类型查询（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#HEkydUci0ockyUx9R8ccjnNqnsO)）|
|medium|int|0|Y|支持媒体查询（0:facebook、18:google、5:tiktok）|
|account\_id|string|332352954368718,392759554778017|N|支持账户查询|
|entity\_name|string|北京汉迪移动互联网科技股份有限公司，北京开户主体|N|支持开户主体查询|
|operate\_status|string|1,2,3|N|支持操作状态查询（1:处理中、2:成功、3:失败）|
|operate\_time|string|2022\-01\-01,2023\-01\-08|N<br>|支持操作时间查询, 仅支持范围查询左闭右闭区间\[2022\-01\-01,2023\-01\-08\]|
|current\_page|int|1|Y|当前页数|
|page\_size|int|100|Y|每页页数, 最高200|
|apply\_ids|string|3456789,456534|N|支持申请ID查询, 多个申请ID以**英文逗号**分隔|
|has\_unblock\_clear|string|true|N|当参数值设为 `true` 时，查询结果将包含所有已解封并清零的记录。若接口响应中的 `operator` 字段显示为 `system@bluefocus.com`，则表明该记录为系统自动解封清零的申请记录。|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" \
-G --data-urlencode "category=1" \
--data-urlencode "medium=0" \
--data-urlencode "account_id=332352954368718,392759554778017" \
--data-urlencode "entity_name=北京汉迪移动互联网科技股份有限公司，北京开户主体" \
--data-urlencode "operate_status=1,2,3" \
--data-urlencode "operate_time=2022-01-01,2023-01-08" \
-X GET https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/operate_record
```



返回字段说明

|字段名|类型|说明|
|---|---|---|
|account\_id|string|账户id|
|apply\_id|int|申请id|
|change\_amount|flaot|变更金额|
|currency|int|币种（见附录）|
|entity\_name|string|开户主体|
|medium|string|媒体（暂不使用）|
|operate\_status|int|操作类型|
|operate\_time|string|操作时间|
|operator|string|操作人|
|reason|string|失败或驳回原因|
|type|int|类型【 额度管理类型 （1:充值、2:减款、3:清零）】<br>类型【facebook 绑定bm类型 （1:绑定、2:解绑）】<br>类型【facebook 绑定像素类型 （1:绑定、2:解绑）】<br>类型【tiktok绑定bc\_id （1:绑定、2:解绑）】<br>类型【tiktok绑定邮箱 （1:绑定、2:解绑）】|
|new\_name|string|新名称【更名】|
|bm\_id|string|bm\_id【facebook绑定bm】|
|pixel\_id|string|pixel\_id【facebook绑定像素】|
|mcc\_id|string|mcc\_id【google接受mcc邀请】|
|mcc\_type|int|类型【google接受mcc邀请（1:接受mcc邀请、2:拒绝mcc邀请、3:一移除mcc）】|
|user\_role\_type|int|类型【google授权个人账户（1:绑定邮箱、2:解绑邮箱）】|
|user\_role\_level|int|权限级别【google授权个人账户（2:管理员、3:标准、4:只读）】|
|email|string|邮箱【google授权个人账户】【tiktok绑定邮箱】|
|role|int|权限级别【tiktok绑定bc\_id\(1:管理员、2:操作者、3:分析师\)】<br>权限级别【tiktok绑定邮箱\(1:管理员、2:操作者、3:分析师\)】|
|bc\_id|string|Tiktok bc\_id|



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {
        "list": [
            {
                "account_id": "795074995023135",
                "apply_id": 222218,
                "medium": null,
                "entity_name": "青岛锦上顺意商贸有限公司",
                "operate_status": 3,
                "currency": 1,
                "reason": "模拟错误",
                "type": 1,
                "change_amount": 1000.0,
                "operator": "jlcs@qq.com",
                "operate_time": "2022-11-16T10:25:53+08:00"
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    },
    "info": null,
    "code": 0
}

```

##### facebook账户额度调整申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/facebook/amount\_spend

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|facebook额度变更数据|
|is\_prepay|boolean|Y|是否预付（针对于API调用 统一填写False）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|facebook广告账户|
|amount|float|Y|操作金额\(注:清零时为0\)|
|currency|string|Y|币种（0:USD、1:HKD、2:CNY、3:APR）|
|type|string|Y|facebook充值操作类型（1:充值、2:减款、3:清零）**`注意: 减款金额取值为负数`**|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "is_prepay":false,
  "applications":[
    {
      "account_id":"751157695942205",
      "currency":2,
      "type":"2",
      "amount":123444
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/facebook/amount_spend
```



返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}

```

##### facebook账户绑定bm申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/facebook/bind\_bm

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|facebook额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|facebook广告账户|
|bind\_bm|list\<string\>|N|绑定的bm\_id|
|role|int|N|绑定的bm\_id角色与bind\_bm同时存在或不存在（1:账户主管、2:账户分析员）|
|unbind\_bm|list\<string\>|N|解绑的bm\_id|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{"applications":[{
"account_id":"751157695942205",
"bind_bm": ["123123", "132131"],
"role":"1",
"unbind_bm":["2342343242","34564654"]}]}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/facebook/bind_bm
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": null,
    "info": null,
    "code": 0
}

```

##### facebook账户绑定像素申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/facebook/bind\_pixel

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|facebook额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|facebook广告账户|
|bind\_pixel|list\<string\>|N|绑定的pixel\_id|
|unbind\_pixel|list\<string\>|N|解绑的pixel\_id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"751157695942205",
      "bind_pixel":[
        "234324",
        "234235"],
      "unbind_pixel":[
        "3534",
        "3453"]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/facebook/bind_pixel
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### facebook账户更名申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/facebook/rename

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|facebook额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|facebook广告账户|
|new\_account\_name|string|Y|新的账户名称|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"751157695942205",
      "new_account_name":"新名字"
        
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/facebook/rename
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
     "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### google账户额度变更申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/google/amount\_spend

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|google额度变更数据|
|is\_prepay|boolean|Y|是否预付（针对于API调用 统一填写False）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|google广告账户|
|charge\_amount|float|Y|操作金额\(注:清零时为0\)|
|currency|string|Y|币种（0:USD、1:HKD、2:CNY、3:APR）|
|charge\_type|string|Y|google充值操作类型（1:充值、2:减款、3:清零）**`注意: 减款金额取值为负数`**|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "is_prepay":false,
  "applications":[
    {
      "account_id":"751157695942205",
      "currency":2,
      "charge_type":"2",
      "charge_amount":123444
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/google/amount_spend
```



返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}

```

##### google账户授权个人邮箱

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/google/user\_role

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|google绑定邮箱数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|google广告账户|
|bind\_email|list\<BINGD\_EMAIL\>|N|绑定邮箱|
|currency|string|N|币种 和绑定邮箱同一请求参数（1:USD、2:HKD、3:CNY、4:APR）|
|unbind\_email|list\<string\>|N|解绑邮箱|

BINGD\_EMAIL

|参数|类型|是否必填|说明|
|---|---|---|---|
|role|string|Y|绑定邮箱授权级别（2:管理员 3:标准 4:只读 5:仅可接受电子邮箱）|
|email|string|Y|绑定邮箱|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"128-773-5201",
      "currency":"2",
      "bind_email":[
        {
          "role":"5",
          "email":"2342342@qq.com"
        },
        {
          "role":"3",
          "email":"42234@qq.com"
        },
        {
          "role":"2",
          "email":"aaa@qq.com"
        },
        {
          "role":"4",
          "email":"123131@qq.com"
        }],
      "unbind_email":[
        "24234@qq.com"]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/google/user_role

```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}

```

##### google账户接受mcc邀请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/google/link\_mcc

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|google接受mcc邀请|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|google广告账户|
|accept\_all\_mcc|int|N|接受邀请全部mcc（0:不邀请 1:邀请）|
|currency|string|N|币种 （1:USD、2:HKD、3:CNY、4:APR）|
|reject\_mcc|list\<string\>|N|拒绝mcc|
|remove\_mcc|list\<string\>|N|移除mcc|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"128-773-5201",
      "accept_all_mcc":1,
      "currency":"0",
      "reject_mcc":[
        "12321",
        "aaaaaaa"],
      "remove_mcc":[
        "12312",
        "bbbbbb"]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/google/user_role
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}

```

##### google账户更名申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/google/rename

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|facebook额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|facebook广告账户|
|new\_account\_name|string|Y|新的账户名称|
|currency|string|Y|币种 （1:USD、2:HKD、3:CNY、4:APR）|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"751157695942205",
      "new_account_name":"新名字"，
      "currency":"1"
        
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/google/rename
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### tiktok账户额度变更申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/tiktok/amount\_spend

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|
|is\_prepay|boolean|Y|是否预付（针对于API调用 统一填写False）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|tiktok广告账户|
|amount|float|Y|操作金额\(注:清零时为0\)|
|currency|string|Y|币种（0:USD、1:HKD、2:CNY、3:APR）|
|type|string|Y|facebook充值操作类型（1:充值、2:减款、3:清零）**`注意: 减款金额取值为负数`**|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "is_prepay":false,
  "applications":[
    {
      "account_id":"751157695942205",
      "currency":2,
      "type":"2",
      "amount":123444
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok/amount_spend
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### tiktok账户绑定bc\_id申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/tiktok/bind\_bc

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|tiktok广告账户|
|bind\_bc|list\<BIND\_BC\>|N|绑定的bc\_id|
|unbind\_bc|list\<string\>|N|解绑的bc\_id|

BIND\_BC

|参数|类型|是否必填|说明|
|---|---|---|---|
|role|string|Y|权限级别（1:管理员 2:操作员 3:分析师）|
|bc|string|Y|绑定的bc\_id|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"7144964209007280129",
      "bind_bc":[
        {
          "role":"3",
          "bc":"333333"
        },
        {
          "role":"2",
          "bc":"222222"
        },
        {
          "role":"1",
          "bc":"111111"
        }],
      "unbind_bc":[
        "131313"]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok/bind_bc
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### tiktok账户绑定邮箱申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/tiktok/bind\_email

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|tiktok广告账户|
|bind\_email|list\<BINGD\_EMAIL\>|N|绑定的email|
|unbind\_email|list\<string\>|N|解绑的email|

BINGD\_EMAIL

|参数|类型|是否必填|说明|
|---|---|---|---|
|role|string|Y|权限级别（1:管理员 2:操作员 3:分析师）|
|email|string|Y|绑定的email|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"7144964209007280129",
      "bind_email":[
        {
          "role":"3",
          "email":"33333@qq.com"
        },
        {
          "role":"2",
          "email":"222222@qq.com"
        },
        {
          "role":"1",
          "email":"11111@qq.com"
        }],
      "unbind_email":[
        "31231@qq.com"]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok/bind_email
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```



##### tiktok账户更名申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/tiktok/rename

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|facebook额度变更数据|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|facebook广告账户|
|new\_account\_name|string|Y|新的账户名称|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"751157695942205",
      "new_account_name":"新名字"
        
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok/rename
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
     "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```



##### 新兴媒体额度变更申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/small\_medium/amount\_spend

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|
|account\_type|int|Y|账户类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnvq4SNE6DFThPERdpvDJyic)）|
|is\_prepay|Boolean|Y|是否预付（针对于API调用 统一填写False）|
|medium|Int|Y|媒体类型（见附录）|
|notes|string|N|申请备注|
|urgent|int|Y|申请加急（0:不加急 1：加急）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|小媒体广告账户|
|type|string|Y|操作类型（1:充值、2：减款、3:清零）**`注意: 减款金额取值为负数`**|
|currency|float|Y|币种（0:USD、1:HKD、2:CNY、3:APR、4:JPY）<br>- Linkedin媒体只能选择CNY|
|amount|float|Y|操作金额（清零操作金额为零）|
|ae\_note|string|N|备注|
|ad\_links|string|N|广告账户链接 Linkedin媒体需必填|
|is\_tax|int|N|是否含税 Linkedin媒体需必填且为1|
|account\_name|string|N|Snapchat媒体必填账户名称|
|entity\_name|string|N|开户主体<br>- 仅限Twitter媒体和Linkedin媒体填写<br>- Twitter媒体必须为英文<br>- Linkedin媒体必须为中文|
|**media\_asset**|object|N|粉丝页handle `Twitter``媒体必填` <br>```JSON<br>**"media_asset":{**<br>**    "handle":"handle1"**<br>**  },**<br>```|
|funding\_source|string|N|需充值funding source` ``Twitter``媒体必填`|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "medium":21,
  "account_type":3,
  "notes":"12312",
  "urgent":1,
  "applications":[
    {
      "account_id":"123213",
      "type":"3",
      "entity_name":"qwqwe",
      "amount":0,
      "currency":"4",
      "fan_page":"1111",
      "funding_source":"222",
      "ae_note":"3123"
    }],
  "is_prepay":false
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/small_medium/amount_spend
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### 新兴媒体绑定申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/small\_medium/bind

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|
|account\_type|int|Y|账户类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnvq4SNE6DFThPERdpvDJyic)）|
|medium|Int|Y|媒体类型（见附录）|
|notes|string|N|申请备注|
|urgent|int|Y|申请加急（0:不加急 1：加急）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|小媒体广告账户|
|ae\_note|string|N|备注|
|account\_name|string|N|Snapchat媒体必填账户名称|
|bind|bing、snapchat: list\<BindStruct\><br>其他媒体: list\<string\>|N|绑定字段|
|unbind|list\<string\>|N|解绑字段|

BindStruct  不同的媒体，结构传参不同

Bing

|参数|类型|是否必填|说明|
|---|---|---|---|
|email|string|Y|邮箱|
|role|string|Y|100: 查看者，16：广告客户市场活动经历|

Snapchat

|参数|类型|是否必填|说明|
|---|---|---|---|
|email|string|Y|邮箱|
|role|string|Y|3: 操作权限，4：查看权限|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "medium":24,
  "account_type":3,
  "notes":"123",
  "urgent":1,
  "applications":[
    {
      "bind":[
        "214234"],
      "unbind":[
        "24234"],
      "ae_note":"1231",
      "account_id":"12313"
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/small_medium/bind
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### 新兴媒体更名申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/small\_medium/rename

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|
|account\_type|int|Y|账户类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnvq4SNE6DFThPERdpvDJyic)）|
|medium|Int|Y|媒体类型（见附录）|
|notes|string|N|申请备注|
|urgent|int|Y|申请加急（0:不加急 1：加急）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|小媒体广告账户|
|ae\_note|string|N|备注|
|account\_name|string|N|Snapchat媒体必填账户名称|
|new\_account\_name|string|Y|新账户名称|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "medium":20,
  "account_type":2,
  "notes":"131",
  "urgent":1,
  "applications":[
    {
      "account_id":"2423",
      "account_name":"2342",
      "new_account_name":"23422342",
      "ae_note":"备注"
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/small_medium/rename
```

返回字段说明



返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### 新兴媒体其他申请

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/small\_medium/other

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|



|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<applications\>|Y|tiktok额度变更数据|
|account\_type|int|Y|账户类型（[见附录](https://bluefocus.feishu.cn/docx/BZlRd4lo3oGcHOxNJLocVvoVnUc#doxcnvq4SNE6DFThPERdpvDJyic)）|
|medium|Int|Y|媒体类型（见附录）|
|notes|string|N|申请备注|
|urgent|int|Y|申请加急（0:不加急 1：加急）|

APPLICATIONS

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|小媒体广告账户|
|ae\_note|string|N|备注|
|content|string|Y|内容|
|account\_name|string|N|Snapchat媒体必填账户名称|



请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "medium":23,
  "account_type":4,
  "notes":"备注",
  "urgent":1,
  "applications":[
    {
      "account_id":"werqwr",
      "content":"需求内容",
      "ae_note":"备注"
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/small_medium/other
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": {apply_id: 222668},
    "info": null,
    "code": 0
}


```

##### tikTok东南亚美金账户列表

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/list`

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|current\_page|int|1|N|当前页数，默认1|
|page\_size|int|10|N|每页条数，默认10|
|account\_id|string|7184697481794617346,7184697481794617347|N|支持广告账户ID查询，逗号分隔，**精确匹配**|
|account\_name|string|BV\-Example|N|支持账户名称查询，**模糊匹配**|
|entity\_name|string|开户主体,开户主体1|N|支持开户主体查询，逗号分隔，**模糊匹配**|
|apply\_id|string|123,124|N|支持申请ID查询，逗号分隔，可带 `C` 前缀也可不带|
|apply\_date|string|2026\-01\-04 00:13:07,2026\-01\-04 15:06:36|N|申请时间范围，起止时间以逗号分隔|
|submitter|string|user@example\.com|N|提单人邮箱，**精确匹配**|
|team\_id|int|0|N|团队ID，**精确匹配**|

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "entity_name=开户主体名称" \
--data-urlencode "current_page=1" \
--data-urlencode "page_size=10" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|记录主键ID|
|account\_id|string|广告账户ID|
|account\_name|string|广告账户名称|
|entity\_name|string|开户主体名称|
|account\_type|int|账户类型（1 竞价、2 品牌）|
|apply\_id|int|开户申请ID（**裸数字，不带 ****`C`**** 前缀**）|
|vertical|int|行业一级分类：0 APP、1 EC、2 Game、3 Branding、4 Fin，未匹配为 \-1|
|promotable\_urls|list\<string\>|推广链接|
|timezone|string|时区|
|status|int|账户状态（见附录 3、TikTok 的「TikTok账户状态」）|
|balance|decimal|账户余额快照|
|balance\_update\_time|string|余额快照更新时间|
|currency|int|币种：0 USD、1 HKD、2 CNY、3 ARP、4 JPY、100 未知|
|create\_time|string|创建时间|
|submitter|string|提单人邮箱|
|team\_id|int|团队ID|

> ⚠️ **`balance`**** 是快照值，不是实时余额。** 需要实时余额与可操作金额请使用「实时查询广告账号余额和状态详情」接口。
> 
> 响应中另含一组被封池相关字段（`disabled_pool_status`、`operation_id`、`operation_status`、`first_withhold_status`、`second_withhold_status`、`event_type`、`account_balance`、`valid_cash_balance` 等）。被封池功能目前**未通过 OpenAPI 对外开放**，这些字段可以忽略。另请注意：**账户处于被封池中时，****`status`**** 会被置为 ****`518`**（该值不在「TikTok账户状态」附录表内）。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "list": [
            {
                "id": 278733,
                "account_id": "7184697481794617346",
                "account_name": "BV-Example-开户主体名称-123-1",
                "entity_name": "开户主体名称",
                "account_type": 1,
                "apply_id": 123,
                "vertical": 1,
                "promotable_urls": ["https://www.example.com"],
                "timezone": "(UTC+07:00)亚洲/胡志明市-Asia/Ho_Chi_Minh",
                "status": 59,
                "balance": "1200.00",
                "balance_update_time": "2026-10-09 10:00:00",
                "currency": 0,
                "create_time": "2026-10-09 14:05:22",
                "submitter": "user@example.com",
                "team_id": 0
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    }
}
```

##### tikTok东南亚美金账户额度变更申请

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/amount_spend`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<APPLICATIONS\>|Y|额度变更明细，必须是非空数组|

**APPLICATIONS**

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|广告账户ID|
|type|int|Y|操作类型：1 充值、2 减款、3 清零|
|amount|number|充值 / 减款时必填|操作金额，**传不带符号的正数**。减款时服务端自动取负值，清零时服务端自动置 0|
|currency|int / string|Y|币种：0 USD、1 HKD、2 CNY、3 ARP、4 JPY。传 `0` 或 `"0"` 均可，**超出该范围会导致请求失败**|

> 同一次请求的 `applications` 里允许混合不同 `type`。
> 
> **付款类别无需传递**：平台按当前签约的付款方式（预付 / 后付）自动判定。签约付款类别正在变更中时，接口返回 `付款类别变更中，不允许发起申请`。
> 
> **同一次请求内的账户必须归属同一个团队**，否则返回 `当前只支持归属一个团队的账户发起充值`。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"7184697481794617346",
      "type":1,
      "amount":1000,
      "currency":0
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/amount_spend
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|本次申请的申请ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"apply_id": 222668}
}
```

常见失败原因

|info|原因|
|---|---|
|请求参数有误！|applications 缺失或不是数组|
|存在被封池账户\(xxx\)，请先移出被封池后再发起申请|账户处于被封池中|
|账户xxx重复, 相同账户请保留一个！|同一请求内出现重复 account\_id|
|请联系AE完善账户对应的签约相关信息，同当前用户的签约相关信息保持一致。|账户不属于当前签约|
|当前只支持归属一个团队的账户发起充值|一次请求内账户跨团队|
|团队额度不足，不允许发起充值申请|团队额度不够|
|付款类别变更中，不允许发起申请|签约付款类别正在变更|
|预付客户无钱包, 不支持额度调整！|预付签约未开通钱包|
|钱包余额不足 / 充值金额与预留金额的和大于当前钱包余额，充值失败|预付钱包余额不足|
|当前信用卡状态异常，不可充值 / 账户充值额度大于信用卡剩余可用额度|后付信用卡异常或超额|
|Wallet is being operated|钱包正被其他操作占用，请稍后重试|
|该账户未在蓝标归档，请联系蓝标AE / 请联系蓝标AE添加账单|账户在申请中心缺少归档或账单|

##### tikTok东南亚美金账户绑定bc\_id申请

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/bind_bc`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<APPLICATIONS\>|Y|绑定 / 解绑明细，必须是非空数组|

**APPLICATIONS**

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|广告账户ID|
|bind\_bc|list\<BIND\_BC\>|绑定时必填|要绑定的商务中心列表|
|unbind\_bc|list\<string\>|解绑时必填|要解绑的商务中心ID列表|

**BIND\_BC**

|参数|类型|是否必填|说明|
|---|---|---|---|
|bc|string|Y|商务中心ID|
|role|int|Y|成员角色|

> `bind_bc` 与 `unbind_bc` 可在同一条明细中同时出现，会被拆成多条子申请处理。
> 
> 

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"7184697481794617346",
      "bind_bc":[{"bc":"7123456789012345678","role":1}],
      "unbind_bc":["7098765432109876543"]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/bind_bc
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|本次申请的申请ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"apply_id": 222669}
}
```

> 账户处于被封池中时返回 `存在被封池账户(xxx)，请先移出被封池后再发起申请`；账户不属于当前签约时返回 `请联系AE完善账户对应的签约相关信息，同当前用户的签约相关信息保持一致。`
> 
> 

##### tikTok东南亚美金账户绑定邮箱申请

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/bind_email`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<APPLICATIONS\>|Y|绑定 / 解绑明细，必须是非空数组|

**APPLICATIONS**

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|广告账户ID|
|bind\_email|list\<BIND\_EMAIL\>|绑定时必填|要绑定的邮箱列表|
|unbind\_email|list\<string\>|解绑时必填|要解绑的邮箱列表|

**BIND\_EMAIL**

|参数|类型|是否必填|说明|
|---|---|---|---|
|email|string|Y|成员邮箱|
|role|int|Y|成员角色|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"7184697481794617346",
      "bind_email":[{"email":"member@example.com","role":1}]
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/bind_email
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|本次申请的申请ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"apply_id": 222670}
}
```

##### tikTok东南亚美金账户更名申请

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/rename`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<APPLICATIONS\>|Y|更名明细，必须是非空数组|

**APPLICATIONS**

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|广告账户ID|
|new\_account\_name|string|Y|新的广告账户名称|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"7184697481794617346",
      "new_account_name":"BV-Example-NewName-01"
    }]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/tiktok_sea_usd/rename
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|本次申请的申请ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"apply_id": 222671}
}
```

##### tikTok东南亚美金账户变更记录

##### open\-ai账户列表

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/openai/list`

- Method：GET

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

请求参数

|参数|类型|例子|是否必填|说明|
|---|---|---|---|---|
|current\_page|int|1|N|当前页数，默认1|
|page\_size|int|10|N|每页条数，默认10|
|account\_id|string|act\_123,act\_456|N|支持广告账户ID查询，逗号分隔，**精确匹配**|
|account\_name|string|BV\-Example|N|支持账户名称查询，**模糊匹配**|
|entity\_name|string|开户主体|N|支持开户主体查询，**模糊匹配**|
|team\_id|int|0|N|团队ID，**精确匹配**|

请求示例

```Bash
curl --get -H "Authorization:Bearer xxx" \
-G --data-urlencode "current_page=1" \
--data-urlencode "page_size=10" \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/openai/list
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|id|int|记录主键ID|
|account\_id|string|广告账户ID|
|account\_name|string|广告账户名称|
|entity\_name|string|开户主体，取不到时为空字符串|
|apply\_id|int \| null|开户申请ID|
|audit\_status|string|开户申请的内部审核状态（见开户管理 open\-ai 附录）|
|apply\_status|string|开户申请的开户状态（见开户管理 open\-ai 附录）|
|sign\_id|int \| null|签约ID|
|status|int \| null|账户状态|
|currency|string|币种 **ISO 代码**（如 `USD`）|
|balance|decimal|账户余额快照|
|balance\_update\_time|string|余额快照更新时间|
|team\_id|int|团队ID，无则为 0|
|create\_time|string|创建时间|

> ⚠️ **`balance`**** 与 ****`balance_update_time`**** 目前恒为 ****`0.00`**** / 空**：open\-ai 暂无余额同步任务，这两个字段不可用作余额判断。查询真实余额与可操作金额请使用「实时查询广告账号余额和状态详情」接口。
> 
> ⚠️ **本接口的 ****`currency`**** 是 ISO 字符串（如 ****`"USD"`****）**，而开户域各接口的 `currency` 是数字枚举（`0`）。两者口径不同，对接时请注意区分。
> 
> open\-ai 账户**不会**出现在「新兴媒体账户列表」接口中，查询 open\-ai 账户只能使用本接口。
> 
> 

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {
        "list": [
            {
                "id": 90123,
                "account_id": "act_1234567890",
                "account_name": "BV-Example-AdAccount-01",
                "entity_name": "开户主体名称",
                "apply_id": 123,
                "audit_status": "APPROVED",
                "apply_status": "SUCCESS",
                "sign_id": 4567,
                "status": 1,
                "currency": "USD",
                "balance": "0.00",
                "balance_update_time": "",
                "team_id": 0,
                "create_time": "2026-10-09 15:10:00"
            }
        ],
        "pagination": {
            "page_size": 10,
            "page_nums": 1,
            "current_page": 1,
            "total": 1
        }
    }
}
```

##### open\-ai账户额度变更申请

> 🔴 **open\-ai 目前仅受理充值。** 减款（`type=2`）与清零（`type=3`）会被直接拒绝，返回 `OpenAI 账户暂不支持减款操作，如有需要请联系您的客户经理` / `OpenAI 账户暂不支持清零操作，如有需要请联系您的客户经理`。
> 
> 

请求协议

- URL：`https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/openai/amount_spend`

- Method：POST

- Content\-Type：application/json

- Header：同上（Authorization）

请求参数

|参数|类型|是否必填|说明|
|---|---|---|---|
|applications|list\<APPLICATIONS\>|Y|充值明细，必须是非空数组|
|notes|string|N|备注|
|urgent|int|N|是否加急，默认0|

**APPLICATIONS**

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_id|string|Y|广告账户ID|
|type|int|Y|操作类型，**目前仅支持 ****`1`****（充值）**|
|amount|number|Y|充值金额，传不带符号的正数|
|currency|int / string|预付签约必填|币种：0 USD、1 HKD、2 CNY、3 ARP、4 JPY|

请求示例

```Bash
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "applications":[
    {
      "account_id":"act_1234567890",
      "type":1,
      "amount":1000,
      "currency":0
    }],
  "notes":"备注"
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/openai/amount_spend
```

返回字段说明

|字段名|类型|说明|
|---|---|---|
|apply\_id|int|本次申请的申请ID|

返回结果示例

```JSON
{
    "code": 0,
    "info": null,
    "data": {"apply_id": 456}
}
```

常见失败原因

|info|原因|
|---|---|
|OpenAI 账户暂不支持减款操作，如有需要请联系您的客户经理|传了 `type=2`|
|OpenAI 账户暂不支持清零操作，如有需要请联系您的客户经理|传了 `type=3`|
|状态为Paused的账户: xxx，不可进行充值操作|**账户尚未通过品牌 \+ 诚信审核**。新开 open\-ai 账户在双审通过前状态恒为 `Paused`，此时无法充值，需等状态变为 `Active`|
|状态为Unknown的账户: xxx，不可进行充值操作|媒体侧读不到账户状态|
|账户存在未完成的资金订单，请等待其完成后再发起：xxx\(充值\)|**同一账户同时只允许一笔资金申请在途**，不区分操作类型。请等上一笔完成后再提交|
|请求参数有误！|applications 缺失或不是数组|
|操作类型有误，账户xxx|type 缺失或非法|
|系统暂无权限操作当前账户xxx|资金服务查不到该账户详情|
|请联系AE完善账户对应的签约相关信息，同当前用户的签约相关信息保持一致。|账户不属于当前签约|
|付款类别变更中，不允许发起申请|签约付款类别正在变更|
|预付客户无钱包, 不支持额度调整！ / 钱包余额不足，目前可用余额为xxx|预付钱包问题|
|当前信用卡状态异常，不可充值 / 账户充值额度大于信用卡剩余可用额度|后付信用卡异常或超额|
|Wallet is being operated|钱包正被其他操作占用，请稍后重试|

#### 广告账号信息查询

|接口|说明|
|---|---|
|实时查询账号余额|支持查询广告账号的余额和状态|

##### 实时查询广告账号余额和状态详情

请求协议

- URL：https://akms\-openapi\.bluemediagroup\.cn/open\_api/v1\.0/application/account\_details

- Method：POST

- Content\-Type:  application/json

- Header：

|字段参数|类型|描述|
|---|---|---|
|Authorization|string|获取的token访问令牌|

|参数|类型|是否必填|说明|
|---|---|---|---|
|account\_ids|list\<string\>|Y|广告账号列表|

请求示例

```PowerShell
curl -H "Authorization:Bearer xxx" -H "Content-Type:application/json" -X POST \
-d '{
  "account_ids": [
    "string"
  ]
}' \
https://akms-openapi.bluemediagroup.cn/open_api/v1.0/application/account_details
```

返回字段说明

返回结果示例

```JSON
HTTPS/1.1 200 OK
{
    "data": [
        {
            "id": 1066072,
            "entity_name": "0927ceshi",
            "account_id": "7419305612632424465",
            "account_name": "BV-ZY-0927ceshi-22703-1",
            "medium": 5,
            "account_type": 1,
            "account_status": 59,    // 账号状态
            "vertical": 1,
            "promotable_urls": [
                "1"
            ],
            "timezone": "(UTC+00:00)\u975e\u6d32/\u963f\u514b\u62c9-Africa/Accra",
            "tax_rate": 0,
            "balance": "0.0",        // 账号余额
            "currency": 0
        }
    ],
    "info": null,
    "code": 0
}

```

# 三、附录

## 1、FaceBook

#### 行业信息

开户申请接口中\`industry\_type\` 字段值请传入\`code\`字段对应的值

|code|name|
|---|---|
|0|APP|
|1|EC|
|2|GAME|
|3|FIN|
|4|BRANDING|

#### facebook开户状态

|code|name|
|---|---|
|0|BF审核中|
|1|BF驳回|
|2|FB审核中|
|3|FB驳回|
|4|开户完成|
|5|取消|
|6|提交审核任务|

#### Facebook 账户状态

|**status**|**状态**|
|---|---|
|1|ACTIVE|
|2|DISABLED|
|3|UNSETTLED|
|7|PENDING\_RISK\_REVIEW|
|8|PENDING\_SETTLEMENT|
|9|IN\_GRACE\_PERIOD|
|100|PENDING\_CLOSURE|
|101|CLOSED|
|201|ANY\_ACTIVE|
|202|ANY\_CLOSED|

## 2、Google



#### 开户类型

开户申请接口中\`customer\_type\` 字段值请传入\`code\`字段对应的值

|code|name|
|---|---|
|0|直客|
|1|代理|

#### 投放地区

开户申请接口中\`throw\_area\` 字段值请传入\`code\`字段对应的值

|code|name|
|---|---|
|0|法国和匈牙利|
|1|中国大陆和中国香港|
|2|其他|

#### 币种

开户申请接口中\`currency\` 字段值请传入\`code\`字段对应的值

|code|name|
|---|---|
|0|USD|
|1|HKD|
|2|CNY|

#### 行业信息

开户申请接口中\`industry\_type\` 字段值请传入\`code\`字段对应的值

|code|name|
|---|---|
|0|APP|
|1|EC|
|2|GAME|
|3|FIN|
|4|BRANDING|

#### Google申请状态

|code|name|
|---|---|
|0|待蓝标审核|
|1|失败|
|2|驳回|
|3|已下户|
|4|部分下户成功（一次申请多个账户下户，可能并不是全部账户都下户成功）|
|5|申请撤回|

#### Google账户状态

|code|name|
|---|---|
|600|UNSPECIFIED|
|601|UNKNOWN|
|602|ENABLED|
|603|CANCELED|
|604|SUSPENDED|
|605|CLOSED|

#### Google操作记录状态

|code|name|
|---|---|
|0|发起申请|
|1|申请撤回|
|2|蓝标通过|
|3|蓝标驳回|
|4|已下户|
|5|下户失败|
|6|部分成功|

#### 时区信息

开户申请接口中\`timezone\` 字段值请传入\`code\`字段对应的值

|name|code|
|---|---|
|||
|\(GMT\+06:00\) 不丹时间|Asia/Thimphu|
|\(GMT\+09:00\) 东帝汶时间|Asia/Dili|
|\(GMT\+08:00\) 中国时间|Asia/Shanghai|
|\(GMT\+01:00\) 中非共和国时间|Africa/Bangui|
|\(GMT\+02:00\) 丹麦时间|Europe/Copenhagen|
|\(GMT\+03:00\) 乌克兰时间|Europe/Kiev|
|\(GMT\+05:00\) 乌兹别克斯坦时间|Asia/Tashkent|
|\(GMT\+03:00\) 乌干达时间|Africa/Kampala|
|\(GMT\-03:00\) 乌拉圭时间|America/Montevideo|
|\(GMT\+01:00\) 乍得时间|Africa/Ndjamena|
|\(GMT\+03:00\) 也门时间|Asia/Aden|
|\(GMT\+04:00\) 亚美尼亚时间|Asia/Yerevan|
|\(GMT\+03:00\) 以色列时间|Asia/Jerusalem|
|\(GMT\+03:00\) 伊拉克时间|Asia/Baghdad|
|\(GMT\-06:00\) 伯利兹时间|America/Belize|
|\(GMT\-01:00\) 佛得角时间|Atlantic/Cape\_Verde|
|\(GMT\+03:00\) 保加利亚时间|Europe/Sofia|
|\(GMT\+02:00\) 克罗地亚时间|Europe/Zagreb|
|\(GMT\+10:00\) 关岛时间|Pacific/Guam|
|\(GMT\) 冈比亚时间|Africa/Banjul|
|\(GMT\) 冰岛时间|Atlantic/Reykjavik|
|\(GMT\) 几内亚时间|Africa/Conakry|
|\(GMT\) 几内亚比绍时间|Africa/Bissau|
|\(GMT\+02:00\) 列支敦士登时间|Europe/Vaduz|
|\(GMT\+01:00\) 刚果（布）时间|Africa/Brazzaville|
|\(GMT\+02:00\) 利比亚时间|Africa/Tripoli|
|\(GMT\) 利比里亚时间|Africa/Monrovia|
|\(GMT\) 加纳时间|Africa/Accra|
|\(GMT\+01:00\) 加蓬时间|Africa/Libreville|
|\(GMT\+02:00\) 匈牙利时间|Europe/Budapest|
|\(GMT\+10:00\) 北马里亚纳群岛时间|Pacific/Saipan|
|\(GMT\-02:00\) 南乔治亚和南桑威奇群岛时间|Atlantic/South\_Georgia|
|\(GMT\+02:00\) 南非时间|Africa/Johannesburg|
|\(GMT\+02:00\) 博茨瓦纳时间|Africa/Gaborone|
|\(GMT\+03:00\) 卡塔尔时间|Asia/Qatar|
|\(GMT\+02:00\) 卢旺达时间|Africa/Kigali|
|\(GMT\+02:00\) 卢森堡时间|Europe/Luxembourg|
|\(GMT\+05:30\) 印度时间|Asia/Calcutta|
|\(GMT\-06:00\) 危地马拉时间|America/Guatemala|
|\(GMT\+03:00\) 厄立特里亚时间|Africa/Asmera|
|\(GMT\+08:00\) 台湾时间|Asia/Taipei|
|\(GMT\+06:00\) 吉尔吉斯斯坦时间|Asia/Bishkek|
|\(GMT\+03:00\) 吉布提时间|Africa/Djibouti|
|\(GMT\-05:00\) 哥伦比亚时间|America/Bogota|
|\(GMT\-06:00\) 哥斯达黎加时间|America/Costa\_Rica|
|\(GMT\+01:00\) 喀麦隆时间|Africa/Douala|
|\(GMT\+12:00\) 图瓦卢时间|Pacific/Funafuti|
|\(GMT\+05:00\) 土库曼斯坦时间|Asia/Ashgabat|
|\(GMT\+03:00\) 土耳其时间|Europe/Istanbul|
|\(GMT\-04:00\) 圣卢西亚时间|America/St\_Lucia|
|\(GMT\-04:00\) 圣基茨和尼维斯时间|America/St\_Kitts|
|\(GMT\) 圣多美和普林西比时间|Africa/Sao\_Tome|
|\(GMT\-04:00\) 圣文森特和格林纳丁斯时间|America/St\_Vincent|
|\(GMT\-02:00\) 圣皮埃尔和密克隆群岛时间|America/Miquelon|
|\(GMT\+07:00\) 圣诞岛时间|Indian/Christmas|
|\(GMT\) 圣赫勒拿时间|Atlantic/St\_Helena|
|\(GMT\+02:00\) 意大利时间|Europe/Rome|
|\(GMT\-04:00\) 圭亚那时间|America/Guyana|
|\(GMT\+03:00\) 坦桑尼亚时间|Africa/Dar\_es\_Salaam|
|\(GMT\+02:00\) 埃及时间|Africa/Cairo|
|\(GMT\+03:00\) 埃塞俄比亚时间|Africa/Addis\_Ababa|
|\(GMT\+05:00\) 塔吉克斯坦时间|Asia/Dushanbe|
|\(GMT\) 塞内加尔时间|Africa/Dakar|
|\(GMT\+02:00\) 塞尔维亚时间|Europe/Belgrade|
|\(GMT\) 塞拉利昂时间|Africa/Freetown|
|\(GMT\+03:00\) 尼科西亚时间|Asia/Nicosia|
|\(GMT\+04:00\) 塞舌尔时间|Indian/Mahe|
|\(GMT\) 多哥时间|Africa/Lome|
|\(GMT\-04:00\) 多米尼克时间|America/Dominica|
|\(GMT\-04:00\) 多米尼加共和国时间|America/Santo\_Domingo|
|\(GMT\+02:00\) 奥地利时间|Europe/Vienna|
|\(GMT\-04:00\) 委内瑞拉时间|America/Caracas|
|\(GMT\+06:00\) 孟加拉国时间|Asia/Dhaka|
|\(GMT\+01:00\) 安哥拉时间|Africa/Luanda|
|\(GMT\-04:00\) 安圭拉时间|America/Anguilla|
|\(GMT\-04:00\) 安提瓜和巴布达时间|America/Antigua|
|\(GMT\+02:00\) 安道尔时间|Europe/Andorra|
|\(GMT\-06:00\) 尼加拉瓜时间|America/Managua|
|\(GMT\+01:00\) 尼日利亚时间|Africa/Lagos|
|\(GMT\+01:00\) 尼日尔时间|Africa/Niamey|
|\(GMT\+05:45\) 尼泊尔时间|Asia/Katmandu|
|\(GMT\+03:00\) 加沙时间|Asia/Gaza|
|\(GMT\-04:00\) 巴哈马时间|America/Nassau|
|\(GMT\+05:00\) 巴基斯坦时间|Asia/Karachi|
|\(GMT\-04:00\) 巴巴多斯时间|America/Barbados|
|\(GMT\+10:00\) 莫尔兹比港时间|Pacific/Port\_Moresby|
|\(GMT\-04:00\) 巴拉圭时间|America/Asuncion|
|\(GMT\-05:00\) 巴拿马时间|America/Panama|
|\(GMT\+03:00\) 巴林时间|Asia/Bahrain|
|\(GMT\) 布基纳法索时间|Africa/Ouagadougou|
|\(GMT\+02:00\) 布隆迪时间|Africa/Bujumbura|
|\(GMT\+03:00\) 希腊时间|Europe/Athens|
|\(GMT\+09:00\) 帕劳时间|Pacific/Palau|
|\(GMT\-10:00\) 库克群岛时间|Pacific/Rarotonga|
|\(GMT\-05:00\) 开曼群岛时间|America/Cayman|
|\(GMT\+02:00\) 德国时间|Europe/Berlin|
|\(GMT\+11:00\) 所罗门群岛时间|Pacific/Guadalcanal|
|\(GMT\+13:00\) 托克劳时间|Pacific/Fakaofo|
|\(GMT\+03:00\) 拉脱维亚时间|Europe/Riga|
|\(GMT\+02:00\) 挪威时间|Europe/Oslo|
|\(GMT\+02:00\) 捷克时间|Europe/Prague|
|\(GMT\+03:00\) 摩尔多瓦时间|Europe/Chisinau|
|\(GMT\+01:00\) 摩洛哥时间|Africa/Casablanca|
|\(GMT\+02:00\) 摩纳哥时间|Europe/Monaco|
|\(GMT\+08:00\) 文莱时间|Asia/Brunei|
|\(GMT\+12:00\) 斐济时间|Pacific/Fiji|
|\(GMT\+02:00\) 斯威士兰时间|Africa/Mbabane|
|\(GMT\+02:00\) 塞尔维亚时间|Europe/Belgrade|
|\(GMT\+05:30\) 斯里兰卡时间|Asia/Colombo|
|\(GMT\+08:00\) 新加坡时间|Asia/Singapore|
|\(GMT\+11:00\) 新喀里多尼亚时间|Pacific/Noumea|
|\(GMT\+09:00\) 日本时间|Asia/Tokyo|
|\(GMT\+07:00\) 柬埔寨时间|Asia/Phnom\_Penh|
|\(GMT\-04:00\) 格林纳达时间|America/Grenada|
|\(GMT\+04:00\) 格鲁吉亚时间|Asia/Tbilisi|
|\(GMT\+02:00\) 比利时时间|Europe/Brussels|
|\(GMT\) 毛里塔尼亚时间|Africa/Nouakchott|
|\(GMT\+04:00\) 毛里求斯时间|Indian/Mauritius|
|\(GMT\+13:00\) 汤加时间|Pacific/Tongatapu|
|\(GMT\+03:00\) 沙特阿拉伯时间|Asia/Riyadh|
|\(GMT\+02:00\) 法国时间|Europe/Paris|
|\(GMT\+05:00\) 法属南部领地时间|Indian/Kerguelen|
|\(GMT\-03:00\) 法属圭亚那时间|America/Cayenne|
|\(GMT\+01:00\) 法罗群岛时间|Atlantic/Faeroe|
|\(GMT\+02:00\) 波兰时间|Europe/Warsaw|
|\(GMT\-04:00\) 波多黎各时间|America/Puerto\_Rico|
|\(GMT\+02:00\) 塞尔维亚时间|Europe/Belgrade|
|\(GMT\+07:00\) 泰国时间|Asia/Bangkok|
|\(GMT\+02:00\) 津巴布韦时间|Africa/Harare|
|\(GMT\-06:00\) 洪都拉斯时间|America/Tegucigalpa|
|\(GMT\-04:00\) 海地时间|America/Port\-au\-Prince|
|\(GMT\+08:00\) 澳门时间|Asia/Macau|
|\(GMT\+01:00\) 爱尔兰时间|Europe/Dublin|
|\(GMT\+03:00\) 爱沙尼亚时间|Europe/Tallinn|
|\(GMT\-05:00\) 牙买加时间|America/Jamaica|
|\(GMT\-04:00\) 特克斯和凯科斯群岛时间|America/Grand\_Turk|
|\(GMT\-04:00\) 特立尼达和多巴哥时间|America/Port\_of\_Spain|
|\(GMT\-04:00\) 玻利维亚时间|America/La\_Paz|
|\(GMT\+12:00\) 瑙鲁时间|Pacific/Nauru|
|\(GMT\+02:00\) 瑞典时间|Europe/Stockholm|
|\(GMT\+02:00\) 瑞士时间|Europe/Zurich|
|\(GMT\-04:00\) 瓜德罗普时间|America/Guadeloupe|
|\(GMT\+12:00\) 瓦利斯和富图纳时间|Pacific/Wallis|
|\(GMT\+11:00\) 瓦努阿图时间|Pacific/Efate|
|\(GMT\+04:00\) 留尼汪时间|Indian/Reunion|
|\(GMT\+03:00\) 白俄罗斯时间|Europe/Minsk|
|\(GMT\-03:00\) 百慕大时间|Atlantic/Bermuda|
|\(GMT\-08:00\) 皮特凯恩群岛时间|Pacific/Pitcairn|
|\(GMT\+02:00\) 直布罗陀时间|Europe/Gibraltar|
|\(GMT\-03:00\) 福克兰群岛（马尔维纳斯群岛）时间|Atlantic/Stanley|
|\(GMT\+03:00\) 科威特时间|Asia/Kuwait|
|\(GMT\+03:00\) 科摩罗时间|Indian/Comoro|
|\(GMT\) 科特迪瓦时间|Africa/Abidjan|
|\(GMT\+06:30\) 科科斯（基林）群岛时间|Indian/Cocos|
|\(GMT\-05:00\) 秘鲁时间|America/Lima|
|\(GMT\+01:00\) 突尼斯时间|Africa/Tunis|
|\(GMT\+03:00\) 立陶宛时间|Europe/Vilnius|
|\(GMT\+03:00\) 索马里时间|Africa/Mogadishu|
|\(GMT\+03:00\) 约旦时间|Asia/Amman|
|\(GMT\+02:00\) 纳米比亚时间|Africa/Windhoek|
|\(GMT\-11:00\) 纽埃时间"|Pacific/Niue|
|\(GMT\-04:00\) 美属维尔京群岛时间|America/St\_Thomas|
|\(GMT\-04:00\) 英属维尔京群岛时间|America/Tortola|
|\(GMT\+06:30\) 缅甸时间|Asia/Rangoon|
|\(GMT\+03:00\) 罗马尼亚时间|Europe/Bucharest|
|\(GMT\-11:00\) 美属萨摩亚时间|Pacific/Pago\_Pago|
|\(GMT\+07:00\) 老挝时间|Asia/Vientiane|
|\(GMT\+03:00\) 肯尼亚时间|Africa/Nairobi|
|\(GMT\+03:00\) 芬兰时间|Europe/Helsinki|
|\(GMT\-03:00\) 苏里南时间|America/Paramaribo|
|\(GMT\+06:00\) 英属印度洋领地时间|Indian/Chagos|
|\(GMT\+02:00\) 荷兰时间|Europe/Amsterdam|
|\(GMT\-04:00\) 库拉索时间|America/Curacao|
|\(GMT\+02:00\) 莫桑比克时间|Africa/Maputo|
|\(GMT\+02:00\) 莱索托时间|Africa/Maseru|
|\(GMT\+08:00\) 菲律宾时间|Asia/Manila|
|\(GMT\-06:00\) 萨尔瓦多时间|America/El\_Salvador|
|\(GMT\+13:00\) 萨摩亚时间|Pacific/Apia|
|\(GMT\-04:00\) 蒙特塞拉特时间|America/Montserrat|
|\(GMT\+01:00\) 西撒哈拉时间|Africa/El\_Aaiun|
|\(GMT\+11:00\) 诺福克岛时间|Pacific/Norfolk|
|\(GMT\+01:00\) 贝宁时间|Africa/Porto\-Novo|
|\(GMT\+02:00\) 赞比亚时间|Africa/Lusaka|
|\(GMT\+01:00\) 赤道几内亚时间|Africa/Malabo|
|\(GMT\+07:00\) 越南时间|Asia/Saigon|
|\(GMT\+04:00\) 阿塞拜疆时间|Asia/Baku|
|\(GMT\+04:30\) 阿富汗时间|Asia/Kabul|
|\(GMT\+01:00\) 阿尔及利亚时间|Africa/Algiers|
|\(GMT\+02:00\) 阿尔巴尼亚时间|Europe/Tirane|
|\(GMT\+04:00\) 阿拉伯联合酋长国时间|Asia/Dubai|
|\(GMT\+04:00\) 阿曼时间|Asia/Muscat|
|\(GMT\-03:00\) 布宜诺斯艾利斯时间|America/Argentina/Buenos\_Aires|
|\(GMT\-04:00\) 阿鲁巴时间|America/Aruba|
|\(GMT\+09:00\) 韩国时间|Asia/Seoul|
|\(GMT\+08:00\) 香港时间|Asia/Hong\_Kong|
|\(GMT\+02:00\) 塞尔维亚时间|Europe/Belgrade|
|\(GMT\+05:00\) 马尔代夫时间|Indian/Maldives|
|\(GMT\+02:00\) 马拉维时间|Africa/Blantyre|
|\(GMT\-04:00\) 马提尼克时间|America/Martinique|
|\(GMT\+08:00\) 马来西亚时间|Asia/Kuala\_Lumpur|
|\(GMT\+03:00\) 马约特时间|Indian/Mayotte|
|\(GMT\+02:00\) 马耳他时间|Europe/Malta|
|\(GMT\+03:00\) 马达加斯加时间|Indian/Antananarivo|
|\(GMT\) 马里时间|Africa/Bamako|
|\(GMT\+03:00\) 黎巴嫩时间|Asia/Beirut|
|\(GMT\+02:00\) 塞尔维亚时间|Europe/Belgrade|
|\(GMT\+12:00\) 夸贾林时间|Pacific/Kwajalein|
|\(GMT\+12:00\) 马绍尔群岛时间|Pacific/Majuro|
|\(GMT\+02:00\) 休达时间|Africa/Ceuta|
|\(GMT\+01:00\) 加那利时间|Atlantic/Canary|
|\(GMT\+02:00\) 西班牙时间|Europe/Madrid|
|\(GMT\+08:00\) 乔巴山时间|Asia/Choibalsan|
|\(GMT\+07:00\) 科布多时间|Asia/Hovd|
|\(GMT\+08:00\) 乌兰巴托时间|Asia/Ulaanbaatar|
|\(GMT\) 亚速尔群岛时间|Atlantic/Azores|
|\(GMT\+01:00\) 葡萄牙时间|Europe/Lisbon|
|\(GMT\) GMT|Etc/GMT|
|\(GMT\+01:00\) 英国时间|Europe/London|
|\(GMT\+13:00\) 恩德伯里时间|Pacific/Enderbury|
|\(GMT\-10:00\) 约翰斯顿时间|Pacific/Johnston|
|\(GMT\-11:00\) 中途岛时间|Pacific/Midway|
|\(GMT\+12:00\) 威克时间|Pacific/Wake|
|\(GMT\-08:00\) 安克雷奇时间|America/Anchorage|
|\(GMT\-05:00\) 芝加哥时间|America/Chicago|
|\(GMT\-06:00\) 丹佛时间|America/Denver|
|\(GMT\-07:00\) 洛杉矶时间|America/Los\_Angeles|
|\(GMT\-04:00\) 纽约时间|America/New\_York|
|\(GMT\-07:00\) 凤凰城时间|America/Phoenix|
|\(GMT\-10:00\) 檀香山时间|Pacific/Honolulu|
|\(GMT\+09:30\) 阿德莱德时间|Australia/Adelaide|
|\(GMT\+10:00\) 布里斯班时间|Australia/Brisbane|
|\(GMT\+09:30\) 达尔文时间|Australia/Darwin|
|\(GMT\+08:45\) 尤克拉时间|Australia/Eucla|
|\(GMT\+10:00\) 霍巴特时间|Australia/Hobart|
|\(GMT\+08:00\) 珀斯时间|Australia/Perth|
|\(GMT\+10:00\) 悉尼时间|Australia/Sydney|
|\(GMT\-09:00\) 甘比尔时间|Pacific/Gambier|
|\(GMT\-09:30\) 马克萨斯时间|Pacific/Marquesas|
|\(GMT\-10:00\) 塔希提时间|Pacific/Tahiti|
|\(GMT\) 丹马沙文时间|America/Danmarkshavn|
|\(GMT\-02:00\) 努克时间|America/Godthab|
|\(GMT\) 斯科列斯比桑德时间|America/Scoresbysund|
|\(GMT\-03:00\) 图勒时间|America/Thule|
|\(GMT\-04:00\) 智利时间|America/Santiago|
|\(GMT\-06:00\) 复活节岛时间|Pacific/Easter|
|\(GMT\+12:45\) 查塔姆时间|Pacific/Chatham|
|\(GMT\+12:00\) 新西兰时间|Pacific/Auckland|
|\(GMT\-03:00\) 阿拉瓜伊纳时间|America/Araguaina|
|\(GMT\-03:00\) 巴伊亚时间|America/Bahia|
|\(GMT\-03:00\) 贝伦时间|America/Belem|
|\(GMT\-04:00\) 博阿维斯塔时间|America/Boa\_Vista|
|\(GMT\-04:00\) 大坎普时间|America/Campo\_Grande|
|\(GMT\-04:00\) 库亚巴时间|America/Cuiaba|
|\(GMT\-03:00\) 福塔雷萨时间|America/Fortaleza|
|\(GMT\-03:00\) 马塞约时间|America/Maceio|
|\(GMT\-04:00\) 马瑙斯时间|America/Manaus|
|\(GMT\-02:00\) 洛罗尼亚时间|America/Noronha|
|\(GMT\-04:00\) 波多韦柳时间|America/Porto\_Velho|
|\(GMT\-03:00\) 累西腓时间|America/Recife|
|\(GMT\-05:00\) 里奥布郎库时间|America/Rio\_Branco|
|\(GMT\-03:00\) 圣保罗时间|America/Sao\_Paulo|
|\(GMT\+11:00\) 库赛埃时间|Pacific/Kosrae|
|\(GMT\+11:00\) 波纳佩岛时间|Pacific/Ponape|
|\(GMT\+10:00\) 特鲁克群岛时间|Pacific/Truk|
|\(GMT\-07:00\) 埃莫西约时间|America/Hermosillo|
|\(GMT\-06:00\) 马萨特兰时间|America/Mazatlan|
|\(GMT\-05:00\) 墨西哥城时间|America/Mexico\_City|
|\(GMT\-07:00\) 蒂华纳时间|America/Tijuana|
|\(GMT\+14:00\) 基里地马地岛时间|Pacific/Kiritimati|
|\(GMT\+12:00\) 塔拉瓦时间|Pacific/Tarawa|
|\(GMT\+06:00\) 阿拉木图时间|Asia/Almaty|
|\(GMT\+05:00\) 阿克套时间|Asia/Aqtau|
|\(GMT\+05:00\) 阿克托别时间|Asia/Aqtobe|
|\(GMT\-05:00\) 厄瓜多尔时间|America/Guayaquil|
|\(GMT\-06:00\) 加拉帕戈斯时间|Pacific/Galapagos|
|\(GMT\+07:00\) 雅加达时间|Asia/Jakarta|
|\(GMT\+09:00\) 查亚普拉时间|Asia/Jayapura|
|\(GMT\+08:00\) 望加锡时间|Asia/Makassar|
|\(GMT\+08:00\) 卡塞时间|Antarctica/Casey|
|\(GMT\+07:00\) 戴维斯时间|Antarctica/Davis|
|\(GMT\+10:00\) 迪蒙迪尔维尔时间|Antarctica/DumontDUrville|
|\(GMT\+05:00\) 莫森时间|Antarctica/Mawson|
|\(GMT\+12:00\) 麦克默多时间|Antarctica/McMurdo|
|\(GMT\-03:00\) 帕默尔时间|Antarctica/Palmer|
|\(GMT\-03:00\) 罗瑟拉时间|Antarctica/Rothera|
|\(GMT\+12:00\) 新西兰时间|Antarctica/South\_Pole|
|\(GMT\+03:00\) 昭和时间|Antarctica/Syowa|
|\(GMT\+06:00\) 沃斯托克时间|Antarctica/Vostok|
|\(GMT\-07:00\) 道森克里克时间|America/Dawson\_Creek|
|\(GMT\-06:00\) 埃德蒙顿时间|America/Edmonton|
|\(GMT\-03:00\) 哈利法克斯时间|America/Halifax|
|\(GMT\-04:00\) 伊魁特时间|America/Iqaluit|
|\(GMT\-04:00\) Montreal时间|America/Montreal|
|\(GMT\-06:00\) 里贾纳时间|America/Regina|
|\(GMT\-02:30\) 圣约翰斯时间|America/St\_Johns|
|\(GMT\-04:00\) 多伦多时间|America/Toronto|
|\(GMT\-07:00\) 温哥华时间|America/Vancouver|
|\(GMT\-07:00\) 怀特霍斯时间|America/Whitehorse|
|\(GMT\-05:00\) 温尼伯时间|America/Winnipeg|
|\(GMT\-06:00\) 耶洛奈夫时间|America/Yellowknife|
|\(GMT\+01:00\) 金沙萨时间|Africa/Kinshasa|
|\(GMT\+02:00\) 卢本巴希时间|Africa/Lubumbashi|
|\(GMT\+08:00\) 伊尔库茨克时间|Asia/Irkutsk|
|\(GMT\+12:00\) 堪察加时间|Asia/Kamchatka|
|\(GMT\+07:00\) 克拉斯诺亚尔斯克时间|Asia/Krasnoyarsk|
|\(GMT\+11:00\) 马加丹时间|Asia/Magadan|
|\(GMT\+06:00\) 鄂木斯克时间|Asia/Omsk|
|\(GMT\+10:00\) 符拉迪沃斯托克时间|Asia/Vladivostok|
|\(GMT\+09:00\) 雅库茨克时间|Asia/Yakutsk|
|\(GMT\+05:00\) 叶卡捷琳堡时间|Asia/Yekaterinburg|
|\(GMT\+02:00\) 加里宁格勒时间|Europe/Kaliningrad|
|\(GMT\+03:00\) 莫斯科时间|Europe/Moscow|
|\(GMT\+04:00\) 萨马拉时间|Europe/Samara|

## 3、TikTok

#### Tiktok操作记录状态

|code|name|
|---|---|
|1|发起申请|
|2|申请撤回|
|3|蓝标驳回|
|4|申请失败|
|5|申请通过|

#### 开户状态

|code|name|
|---|---|
|1|待蓝标审核|
|3|驳回|
|4|处理中|
|5|下户失败|
|6|已下户|

#### TikTok账户状态

|code|name|说明|
|---|---|---|
|55|STATUS\_DISABLE|该广告账户已关户|
|56|STATUS\_PENDING\_CONFIRM|申请待审核|
|57|STATUS\_PENDING\_VERIFIED|待验证|
|58|STATUS\_CONFIRM\_FAIL|审核不通过|
|59|STATUS\_ENABLE|审核通过|
|510|STATUS\_CONFIRM\_FAIL\_END|CRM审核不通过|
|511|STATUS\_PENDING\_CONFIRM\_MODIFY|修改待审核|
|512|STATUS\_CONFIRM\_MODIFY\_FAIL|修改审核不通过|
|513|STATUS\_LIMIT|用户被惩罚|
|514|STATUS\_WAIT\_FOR\_BPM\_AUDIT|等待CRM审核|
|515|STATUS\_WAIT\_FOR\_PUBLIC\_AUTH|待对公验证|
|516|STATUS\_SELF\_SERVICE\_UNAUDITED|自助开户待验证资质|
|517|STATUS\_CONTRACT\_PENDING|合同未生效|

#### 行业信息（三级分类）

开户申请接口中\`industry\_type\`字段值请传入\`code\`字段对应的值

#### 时区信息

开户申请接口中\`timezone\` 字段值请传入\`code\`字段对应的值



|code|name|time|
|---|---|---|
|Africa/Accra|非洲/阿克拉|UTC\+00:00|
|Africa/Cairo|非洲/开罗|UTC\+02:00|
|Africa/Casablanca|非洲/卡萨布兰卡|UTC\+00:00|
|Africa/Johannesburg|非洲/约翰内斯堡|UTC\+02:00|
|Africa/Lagos|非洲/拉各斯|UTC\+01:00|
|Africa/Nairobi|非洲/内罗毕|UTC\+03:00|
|Africa/Tunis|非洲/突尼斯|UTC\+01:00|
|America/Anchorage|美洲/安克雷奇|UTC\-09:00|
|America/Argentina/Buenos\_Aires|美洲/阿根廷/布宜诺斯艾利斯|UTC\-03:00|
|America/Argentina/Salta|美洲/阿根廷/萨尔塔|UTC\-03:00|
|America/Argentina/San\_Luis|美洲/阿根廷/圣路易斯|UTC\-03:00|
|America/Asuncion|美洲/亚松森|UTC\-04:00|
|America/Atikokan|美国/阿提科坎|UTC\-05:00|
|America/Belem|美洲/贝伦|UTC\-03:00|
|America/Blanc\-Sablon|美洲/白朗萨布隆|UTC\-04:00|
|America/Bogota|美洲/波哥大|UTC\-05:00|
|America/Campo\_Grande|美洲/大坎普|UTC\-04:00|
|America/Caracas|美洲/加拉加斯|UTC\-04:30|
|America/Chicago|美洲/芝加哥|UTC\-06:00|
|America/Costa\_Rica|美洲/哥斯达黎加|UTC\-06:00|
|America/Dawson|美洲/道森|UTC\-08:00|
|America/Dawson\_Creek|美洲/道森河|UTC\-07:00|
|America/Denver|美洲/丹佛|UTC\-07:00|
|America/Edmonton|美洲/艾德蒙顿|UTC\-07:00|
|America/El\_Salvador|美洲/萨尔瓦多|UTC\-06:00|
|America/Guatemala|美洲/危地马拉|UTC\-06:00|
|America/Guayaquil|美洲/瓜亚基尔|UTC\-05:00|
|America/Halifax|美洲/哈利法克斯|UTC\-04:00|
|America/Hermosillo|美洲/赫莫西洛|UTC\-07:00|
|America/Iqaluit|美洲/伊卡鲁伊特|UTC\-05:00|
|America/Jamaica|美洲/牙买加|UTC\-05:00|
|America/La\_Paz|美洲/拉巴斯|UTC\-04:00|
|America/Lima|美洲/利马|UTC\-05:00|
|America/Los\_Angeles|美洲/洛杉矶|UTC\-08:00|
|America/Managua|美洲/马那瓜|UTC\-06:00|
|America/Mazatlan|美洲/馬薩特蘭|UTC\-07:00|
|America/Mexico\_City|美洲/墨西哥城|UTC\-06:00|
|America/Montevideo|美洲/蒙得维的亚|UTC\-03:00|
|America/Nassau|美洲/拿骚港|UTC\-05:00|
|America/New\_York|美洲/纽约|UTC\-05:00|
|America/Noronha|美洲/诺隆尼亚|UTC\-02:00|
|America/Panama|美洲/巴拿马|UTC\-05:00|
|America/Phoenix|美洲/凤凰城|UTC\-07:00|
|America/Port\_of\_Spain|美洲/西班牙港口|UTC\-04:00|
|America/Puerto\_Rico|美洲/波多黎各|UTC\-04:00|
|America/Rainy\_River|美洲/雷尼里弗|UTC\-06:00|
|America/Regina|美洲/里贾纳|UTC\-06:00|
|America/Santiago|美洲/圣地亚哥|UTC\-04:00|
|America/Santo\_Domingo|美洲/桑托多明哥|UTC\-04:00|
|America/Sao\_Paulo|美洲/圣保罗|UTC\-03:00|
|America/St\_Johns|美洲/圣约翰|UTC\-03:30|
|America/Tegucigalpa|美洲/特古西加尔巴|UTC\-06:00|
|America/Tijuana|美洲/蒂华纳|UTC\-08:00|
|America/Toronto|美国/多伦多|UTC\-05:00|
|America/Vancouver|美洲/温哥华|UTC\-08:00|
|Asia/Amman|亚洲/安曼|UTC\+02:00|
|Asia/Baghdad|亚洲/巴格达|UTC\+03:00|
|Asia/Bahrain|亚洲/巴林|UTC\+03:00|
|Asia/Bangkok|亚洲/曼谷|UTC\+07:00|
|Asia/Beirut|亚洲/贝鲁特|UTC\+02:00|
|Asia/Colombo|亚洲/科伦坡|UTC\+05:30|
|Asia/Dhaka|亚洲/达卡|UTC\+06:00|
|Asia/Dubai|亚洲/迪拜|UTC\+04:00|
|Asia/Gaza|亚洲/加沙|UTC\+02:00|
|Asia/Ho\_Chi\_Minh|亚洲/胡志明市|UTC\+07:00|
|Asia/Hong\_Kong|亚洲/香港|UTC\+08:00|
|Asia/Irkutsk|亚洲/伊尔库茨克|UTC\+08:00|
|Asia/Jakarta|亚洲/雅加达|UTC\+07:00|
|Asia/Jayapura|亚洲/贾亚普拉|UTC\+09:00|
|Asia/Jerusalem|亚洲/耶路撒冷|UTC\+02:00|
|Asia/Kamchatka|亚洲/堪察加半岛|UTC\+11:00|
|Asia/Karachi|亚洲/卡拉奇|UTC\+05:00|
|Asia/Kolkata|亚洲/加尔各答|UTC\+05:30|
|Asia/Krasnoyarsk|亚洲/克拉斯诺亚尔斯克|UTC\+07:00|
|Asia/Kuala\_Lumpur|亚洲/吉隆坡|UTC\+08:00|
|Asia/Kuwait|亚洲/科威特|UTC\+03:00|
|Asia/Magadan|亚洲/马加丹|UTC\+11:00|
|Asia/Makassar|亚洲/马卡萨尔|UTC\+08:00|
|Asia/Manila|亚洲/马尼拉|UTC\+08:00|
|Asia/Muscat|亚洲/麝香葡萄酒|UTC\+04:00|
|Asia/Nicosia|亚洲/尼科西亚|UTC\+02:00|
|Asia/Omsk|亚洲/鄂木斯克|UTC\+06:00|
|Asia/Qatar|亚洲/卡塔尔|UTC\+03:00|
|Asia/Riyadh|亚洲/利雅得|UTC\+03:00|
|Asia/Seoul|亚洲/首尔|UTC\+09:00|
|Asia/Shanghai|亚洲/北京|UTC\+08:00|
|Asia/Singapore|亚洲/新加坡|UTC\+08:00|
|Asia/Taipei|亚洲/台北|UTC\+08:00|
|Asia/Tokyo|亚洲/东京|UTC\+09:00|
|Asia/Vladivostok|亚洲/海参崴|UTC\+10:00|
|Asia/Yakutsk|亚洲/雅库茨克|UTC\+09:00|
|Asia/Yekaterinburg|亚洲/叶卡捷琳堡|UTC\+05:00|
|Atlantic/Azores|大西洋/亚速尔群岛|UTC\-01:00|
|Atlantic/Canary|大西洋/加那利群岛|UTC\+00:00|
|Atlantic/Reykjavik|大西洋/雷克雅未克|UTC\+00:00|
|Australia/Broken\_Hill|澳洲/布罗肯希尔|UTC\+09:30|
|Australia/Perth|澳洲/珀斯|UTC\+08:00|
|Australia/Sydney|澳洲/悉尼|UTC\+10:00|
|Europe/Amsterdam|欧洲/阿姆斯特丹|UTC\+01:00|
|Europe/Athens|欧洲/雅典|UTC\+02:00|
|Europe/Belgrade|欧洲/贝尔格莱德|UTC\+01:00|
|Europe/Berlin|欧洲/柏林|UTC\+01:00|
|Europe/Bratislava|欧洲/布拉迪斯拉发|UTC\+01:00|
|Europe/Brussels|欧洲/布鲁塞尔|UTC\+01:00|
|Europe/Bucharest|欧洲/布加勒斯特|UTC\+02:00|
|Europe/Budapest|欧洲/布达佩斯|UTC\+01:00|
|Europe/Copenhagen|欧洲/哥本哈根|UTC\+01:00|
|Europe/Dublin|欧洲/都柏林|UTC\+00:00|
|Europe/Helsinki|欧洲/赫尔辛基|UTC\+02:00|
|Europe/Istanbul|欧洲/伊斯坦布尔|UTC\+02:00|
|Europe/Kaliningrad|欧洲/加里宁格勒|UTC\+02:00|
|Europe/Kiev|欧洲/基辅|UTC\+02:00|
|Europe/Lisbon|欧洲/里斯本|UTC\+00:00|
|Europe/Ljubljana|欧洲/卢布尔雅那|UTC\+01:00|
|Europe/London|欧洲/伦敦|UTC\+00:00|
|Europe/Luxembourg|欧洲/卢森堡|UTC\+01:00|
|Europe/Madrid|欧洲/马德里|UTC\+01:00|
|Europe/Malta|欧洲/马耳他|UTC\+01:00|
|Europe/Moscow|欧洲/莫斯科|UTC\+03:00|
|Europe/Oslo|欧洲/奥斯陆|UTC\+01:00|
|Europe/Paris|欧洲/巴黎|UTC\+01:00|
|Europe/Prague|欧洲/布拉格|UTC\+01:00|
|Europe/Riga|欧洲/里加|UTC\+02:00|
|Europe/Rome|欧洲/罗马|UTC\+01:00|
|Europe/Samara|欧洲/萨马拉|UTC\+03:00|
|Europe/Sarajevo|欧洲/萨拉热窝|UTC\+01:00|
|Europe/Skopje|欧洲/斯科普里|UTC\+01:00|
|Europe/Sofia|欧洲/索非亚|UTC\+02:00|
|Europe/Stockholm|欧洲/斯德哥尔摩|UTC\+01:00|
|Europe/Tallinn|欧洲/塔林|UTC\+02:00|
|Europe/Vienna|欧洲/维也纳|UTC\+01:00|
|Europe/Vilnius|欧洲/维尔纽斯|UTC\+02:00|
|Europe/Warsaw|欧洲/华沙|UTC\+01:00|
|Europe/Zagreb|欧洲/萨格勒布|UTC\+01:00|
|Europe/Zurich|欧洲/苏黎世|UTC\+01:00|
|Indian/Maldives|印度洋/马尔代夫|UTC\+05:00|
|Indian/Mauritius|印度洋/毛里求斯|UTC\+04:00|
|Pacific/Apia|太平洋/阿皮亚|UTC\-11:00|
|Pacific/Auckland|太平洋/奥克兰|UTC\+12:00|
|Pacific/Easter|太平洋/复活节岛|UTC\-06:00|
|Pacific/Galapagos|太平洋/加拉帕戈斯群岛|UTC\-06:00|
|Pacific/Honolulu|太平洋/火奴鲁鲁|UTC\-10:00|
|Pacific/Majuro|太平洋/马朱罗|UTC\-12:00|
|Pacific/Midway|太平洋/中途岛|UTC\-11:00|
|Pacific/Niue|太平洋/纽埃|UTC\-11:00|
|Pacific/Pago Pago|太平洋/帕果帕果|UTC\-11:00|
|Pacific/Pago\_Pago|太平洋/帕果帕果|UTC\-11:00|

#### 地区代码

开户申请中\`registered\_area\`字段值请传入\`code\`字段对应的值

|code|name|
|---|---|
|AD|安道尔|
|AE|阿联酋|
|AF|阿富汗|
|AG|安提瓜和巴布达|
|AL|阿尔巴尼亚|
|AM|亚美尼亚|
|AO|安哥拉|
|AR|阿根廷|
|AT|奥地利|
|AU|澳大利亚|
|AZ|阿塞拜疆|
|BA|波黑|
|BB|巴巴多斯|
|BD|孟加拉国|
|BE|比利时|
|BF|布基纳法索|
|BG|保加利亚|
|BH|巴林|
|BI|布隆迪|
|BJ|贝宁|
|BN|文莱|
|BO|玻利维亚|
|BR|巴西|
|BS|巴哈马|
|BT|不丹|
|BW|博茨瓦纳|
|BY|白俄罗斯|
|BZ|伯利兹|
|CA|加拿大|
|CH|瑞士|
|CI|科特迪瓦|
|CL|智利|
|CM|喀麦隆|
|CN|中国|
|CO|哥伦比亚|
|CR|哥斯达黎加|
|CV|佛得角|
|CY|塞浦路斯|
|CZ|捷克|
|DE|德国|
|DJ|吉布提|
|DK|丹麦|
|DM|多米尼克|
|DO|多米尼加|
|DZ|阿尔及利亚|
|EC|厄瓜多尔|
|EE|爱沙尼亚|
|EG|埃及|
|ER|厄立特里亚|
|ES|西班牙|
|ET|埃塞俄比亚|
|FI|芬兰|
|FJ|斐济|
|FM|密克罗尼西亚联邦|
|FR|法国|
|GA|加蓬|
|GB|英国|
|GD|格林纳达|
|GE|格鲁吉亚|
|GH|加纳|
|GM|冈比亚|
|GN|几内亚|
|GQ|赤道几内亚|
|GR|希腊|
|GT|危地马拉|
|GW|几内亚比绍|
|GY|圭亚那|
|HK|香港|
|HN|洪都拉斯|
|HR|克罗地亚|
|HT|海地|
|HU|匈牙利|
|ID|印度尼西亚|
|IE|爱尔兰|
|IL|以色列|
|IN|印度|
|IQ|伊拉克|
|IS|冰岛|
|IT|意大利|
|JM|牙买加|
|JO|约旦|
|JP|日本|
|KE|肯尼亚|
|KG|吉尔吉斯斯坦|
|KH|柬埔寨|
|KI|基里巴斯|
|KM|科摩罗|
|KN|圣基茨和尼维斯|
|KR|韩国|
|KW|科威特|
|KY|开曼群岛|
|KZ|哈萨克斯坦|
|LA|老挝|
|LB|黎巴嫩|
|LC|圣卢西亚|
|LI|列支敦士登|
|LK|斯里兰卡|
|LR|利比里亚|
|LS|莱索托|
|LT|立陶宛|
|LU|卢森堡|
|LV|拉脱维亚|
|LY|利比亚|
|MA|摩洛哥|
|MC|摩纳哥|
|MD|摩尔多瓦|
|ME|黑山|
|MG|马达加斯加|
|MH|马绍尔群岛|
|MK|马其顿|
|ML|马里|
|MM|缅甸|
|MN|蒙古国|
|MO|澳门|
|MR|毛里塔尼亚|
|MT|马耳他|
|MU|毛里求斯|
|MV|马尔代夫|
|MW|马拉维|
|MX|墨西哥|
|MY|马来西亚|
|MZ|莫桑比克|
|NA|纳米比亚|
|NE|尼日尔|
|NG|尼日利亚|
|NI|尼加拉瓜|
|NL|荷兰|
|NO|挪威|
|NP|尼泊尔|
|NR|瑙鲁|
|NZ|新西兰|
|OM|阿曼|
|PA|巴拿马|
|PE|秘鲁|
|PG|巴布亚新几内亚|
|PH|菲律宾|
|PK|巴基斯坦|
|PL|波兰|
|PR|波多黎各|
|PS|巴勒斯坦\*|
|PT|葡萄牙|
|PW|帕劳|
|PY|巴拉圭|
|QA|卡塔尔|
|RO|罗马尼亚|
|RS|塞尔维亚|
|RU|俄罗斯|
|RW|卢旺达|
|SA|沙特阿拉伯|
|SB|所罗门群岛|
|SC|塞舌尔|
|SE|瑞典|
|SG|新加坡|
|SI|斯洛文尼亚|
|SK|斯洛伐克|
|SL|塞拉利昂|
|SM|圣马力诺|
|SN|塞内加尔|
|SO|索马里|
|SR|苏里南|
|ST|圣多美和普林西比|
|SV|萨尔瓦多|
|SZ|斯威士兰|
|TD|乍得|
|TG|多哥|
|TH|泰国|
|TJ|塔吉克斯坦|
|TL|东帝汶|
|TM|土库曼斯坦|
|TN|突尼斯|
|TO|汤加|
|TR|土耳其|
|TT|特立尼达和多巴哥|
|TV|图瓦卢|
|TW|台湾|
|TZ|坦桑尼亚|
|UA|乌克兰|
|UG|乌干达|
|US|美国|
|UY|乌拉圭|
|UZ|乌兹别克斯坦|
|VA|梵蒂冈|
|VC|圣文森特和格林纳丁斯|
|VE|委内瑞拉|
|VG|英属维尔京群岛|
|VN|越南|
|VU|瓦努阿图|
|WS|萨摩亚|
|YE|也门|
|ZA|南非|
|ZM|赞比亚|
|ZW|津巴布韦|



## 4、小媒体（其他媒体）

#### 其他媒体申请类型

|code|name|
|---|---|
|0|额度管理|
|1|绑定|
|2|更名|
|3|其他|

#### 其他媒体申请状态类型

|code|name|
|---|---|
|0|处理中|
|1|成功|
|2|失败|
|3|驳回|

#### 小媒体（其他类型）





## 5、需求申请记录

#### 需求申请分类（category）

|code|name|
|---|---|
|1|额度管理|
|2|更名|
|3|绑定bm|
|4|绑定像素|
|5|接受mcc邀请|
|6|授权个人账户|
|7|绑定bc\_id|
|8|绑定邮箱|



```Makefile
message: "{sub_message}"
```

|媒体|sub\_code|sub\_message|
|---|---|---|
|GG/TT|40000|UNKNOWN|
|GG/TT|40001|PARAMS VALIDATE ERROR|
|GG/TT|40201|ACCOUNT NOT FOUND|
|GG/TT|40202|ACCOUNT STATUS ERROR|
|GG/TT|40202|增/减额账户状态异常, 状态为:xxx|
|GG/TT|40303|减额账户余额不足, 无法执行, 可用余额: 0\.00美元|
|GG/TT|40111|Tiktok/Google服务异常|
|Google|40111|Cannot propose a budget update without actually changing any fields\.|
|Google|40111|Budgets that have a pending update cannot be updated\.|
|Google|40111|customer not exist or not belong to smb|
|Google|40111|there is a budget that does not belong to smb|
|Google|40111|internal\_error:DEADLINE\_EXCEEDED|
|Google|40111|internal\_error:INTERNAL\_ERROR|
|Google|40111|request\_error:UNKNOWN|
|Google|40111|rpc error: code = Internal desc = Internal error encountered\.|
|Google|40111|there is a budget that does not belong to smb|
|Google|40111|Unauthenticated|
|Tiktok|40121|account show status not approved|
|Tiktok|40121|No permission to view or operate\.|
|Tiktok|40121|Sorry, This Adv need hook billing group\. otherwise not allowed transfer balance|
|Tiktok|40121|System error|
|Tiktok|40121|This Business Center has not yet linked to the advertiser\. Increasing and decreasing balance are not allowed\.|
|Tiktok|40121|Invalid value for amount: The min transfer amount is 10\.0\.|
||||





> （注：部分内容由豆包工作 AI 生成）
