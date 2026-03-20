数据库结构设计
A. ads_metrics (指标 CSV 数据)
date: date

campaign_name: text

product_line: text (ft / pu / ppt / other，依据 campaign_name 前缀自动填充)

spend: decimal (费用/消耗，保留两位小数)

budget: decimal (预算，保留两位小数)

ads_conversions: int (预留字段，目前固定为 0)

B. server_paid_data (新 JID 付费 CSV 数据)
date: date

campaign_name: text

paid_users: int (与 new_jid_users 相同，保留扩展空间)

new_jid_users: int (新 JID 付费人数，用于计算新用户 CPA)

new_ios_jid_users: int (新 IOS JID 数量，来自新 JID 付费表对应列；用于计算新 IOS 用户 CPA)

new_android_jid_users: int (新安卓 JID 数量，来自新 JID 付费表对应列)

C. daily_notes (日备注)
date: date (PK)

content: text

D. campaign_notes (系列备注)
date: date

campaign_name: text

content: text

约定：仅由用户在前端编辑或清空保存时写入/删除；指标表 CSV、新 JID 付费表 CSV、Ads 同步均不写入或删除此表，备注永久保留。