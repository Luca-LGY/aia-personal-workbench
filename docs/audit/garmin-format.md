# 佳明归档格式说明（去值，供 T15）

观测时间：2026-10-25T21:25:32+08:00。只读源为 `/Users/lgy/Documents/我的AI档案/运动`。本文件仅记录文件路径、字段名、观察到的类型和日期／质量关系；未复制原始数据、健康数值或个人正文，未调用 Garmin、改动档案或原采集安排。最近日目录在本次观测中同时含每日、周度和发布验收格式，不能用单一固定对象假定全部快照。

## 已读取的结构来源

| 绝对文件路径 | 结构用途 |
| --- | --- |
| /Users/lgy/Documents/我的AI档案/运动/数据/2026-10-25/佳明快照.json | JSON 字段结构 |
| /Users/lgy/Documents/我的AI档案/运动/数据/2026-10-25/周度复盘发布验收_210550.json | JSON 字段结构 |
| /Users/lgy/Documents/我的AI档案/运动/数据/2026-10-25/周度复盘快照_210550.json | JSON 字段结构 |
| /Users/lgy/Documents/我的AI档案/运动/数据/2026-10-25/周度复盘来源与质量_210550.json | JSON 字段结构 |
| /Users/lgy/Documents/我的AI档案/运动/数据/2026-10-25/来源与质量.json | JSON 字段结构 |
| /Users/lgy/Documents/我的AI档案/运动/活动记录.md | Markdown 表头／段落结构 |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | Markdown 表头／段落结构 |
| /Users/lgy/Documents/我的AI档案/运动/同步状态.md | Markdown 表头／段落结构 |
| /Users/lgy/Documents/我的AI档案/运动/待补齐.json | 缺项队列元数据字段结构 |

本次范围仅为这些文件。历史 JSON 的格式兼容性尚未穷举；当前样本有 `schema_version` 字段，但这里不导出其实际值。不能据此宣称所有日期格式一致。

## JSON 顶层字段

| 文件 | 顶层字段 |
| --- | --- |
| 佳明快照.json | `schema_version`、`archive_date`、`timezone`、`sources`、`region`、`collection_trigger`、`collection_status`、`collection_window`、`recorded_at`、`unit_system`、`record_recovery`、`coverage`、`request_results`、`daily_stats`、`sleep`、`current_day_stats`、`hrv`、`resting_heart_rate`、`training_status`、`training_readiness`、`training_readiness_collected_at`、`activities_in_lookback`、`activity_delta`、`retained_activity_index`、`coach_schedule`、`coach_workout_details`、`derived_metrics`、`sleep_stage_duration_mismatches`、`quality_flags` |
| 周度复盘发布验收_210550.json | `schema_version`、`source`、`timezone`、`natural_week`、`status`、`repository`、`branch`、`data_parent_commit`、`data_commit`、`publication`、`verified_at`、`readback_ref`、`head_at_readback`、`verified_file_count`、`files`、`garmin_read_requests`、`collection_window`、`checks`、`unresolved_information`、`unchanged_systems`、`other_device_pull_verified`、`note` |
| 周度复盘快照_210550.json | `schema_version`、`archive_date`、`timezone`、`sources`、`collection_trigger`、`collection_window`、`collection_status`、`unit_system`、`coverage`、`activities_in_lookback`、`activity_delta`、`daily_stats`、`sleep`、`current_day_stats`、`hrv`、`training_status`、`training_readiness`、`training_readiness_collected_at`、`coach_schedules`、`coach_workout_detail_reuse`、`derived_metrics`、`last_four_natural_weeks`、`historical_field_corrections`、`same_day_summary_update`、`quality_flags`、`archive_publication` |
| 周度复盘来源与质量_210550.json | `schema_version`、`source`、`timezone`、`collection_window`、`read_request_count`、`success_count`、`failed_count`、`retry_count`、`tool_calls`、`comparisons`、`quality_flags`、`archive_publication`、`external_sources_rechecked_on`、`external_sources`、`stable_memory_changed` |
| 来源与质量.json | `schema_version`、`archive_date`、`timezone`、`sources`、`collection_trigger`、`collection_status`、`collection_window`、`recorded_at`、`record_recovery`、`connection`、`counts`、`attempts`、`requests`、`snapshot_path`、`actual_data_coverage`、`quality_flags`、`sleep_stage_duration_mismatches`、`archive_verification`、`resolution_counts_note` |

`quality_flags` 是字符串数组，包含自由文本说明，不是可直接假定的固定枚举；此次未复制其原文。`sources`／`source` 是来源标识入口，须和文件路径一起保留追溯关系。

## 关键数据对象字段（类型为当前每日与周度样本的并集）

| 字段路径 | 关键子字段及观察类型 |
| --- | --- |
| daily_stats | `active_calories: number`、`active_seconds: number`、`avg_spo2_percent: number`、`avg_stress_level: number`、`avg_waking_respiration: number`、`bmr_calories: number`、`body_battery_charged: number`、`body_battery_current: number`、`body_battery_drained: number`、`body_battery_highest: number`、`body_battery_lowest: number`、`collected_at: string`、`daily_step_goal: number`、`date: string`、`distance_meters: number`、`floors_ascended: number`、`floors_descended: number`、`highest_respiration: number`、`highly_active_seconds: number`、`intensity_minutes_goal: number`、`is_partial: boolean`、`last_7_days_avg_resting_hr: number`、`lowest_respiration: number`、`lowest_spo2_percent: number`、`max_heart_rate_bpm: number`、`max_stress_level: number`、`min_heart_rate_bpm: number`、`moderate_intensity_minutes: number`、`resting_heart_rate_bpm: number`、`sedentary_seconds: number`、`sleeping_seconds: number`、`stress_qualifier: string`、`total_calories: number`、`total_steps: number`、`vigorous_intensity_minutes: number` |
| sleep | `avg_overnight_hrv: number`、`avg_sleep_stress: number`、`awake_count: number`、`awake_seconds: number`、`collected_at: string`、`date: string`、`deep_sleep_percent: number`、`deep_sleep_seconds: number`、`light_sleep_percent: number`、`light_sleep_seconds: number`、`nap_seconds: number`、`rem_sleep_percent: number`、`rem_sleep_seconds: number`、`sleep_end: number`、`sleep_hours: number`、`sleep_score: number`、`sleep_score_qualifier: string`、`sleep_seconds: number`、`sleep_start: number` |
| current_day_stats | `active_calories: number`、`active_seconds: number`、`avg_spo2_percent: number`、`avg_stress_level: number`、`avg_waking_respiration: number`、`bmr_calories: number`、`body_battery_charged: number`、`body_battery_current: number`、`body_battery_drained: number`、`body_battery_highest: number`、`body_battery_lowest: number`、`collected_at: string`、`daily_step_goal: number`、`date: string`、`distance_meters: number`、`floors_ascended: number`、`highest_respiration: number`、`highly_active_seconds: number`、`intensity_minutes_goal: number`、`is_partial: boolean`、`is_possibly_lagged: boolean`、`is_possibly_lagged_or_different_scope: boolean`、`last_7_days_avg_resting_hr: number`、`lowest_respiration: number`、`lowest_spo2_percent: number`、`max_heart_rate_bpm: number`、`max_stress_level: number`、`min_heart_rate_bpm: number`、`moderate_intensity_minutes: number`、`resting_heart_rate_bpm: number`、`sedentary_seconds: number`、`sleeping_seconds: number`、`stress_qualifier: string`、`total_calories: number`、`total_steps: number`、`upstream_updated_at: null`、`vigorous_intensity_minutes: number` |
| hrv | `baseline_balanced_low_ms: number`、`baseline_balanced_upper_ms: number`、`baseline_low_upper_ms: number`、`collected_at: string`、`date: string`、`feedback: string`、`last_night_5min_high_hrv_ms: number`、`last_night_avg_hrv_ms: number`、`sleep_end: string`、`sleep_start: string`、`status: string`、`weekly_avg_hrv_ms: number` |
| resting_heart_rate | `collected_at: string`、`date: string`、`independent_interface_skipped: boolean`、`resting_heart_rate_bpm: number`、`source: string` |
| training_status | `acute_load: number`、`acwr_percent: number`、`acwr_status: string`、`chronic_load: number`、`collected_at: string`、`date: string`、`fitness_trend: number`、`load_ratio: number`、`monthly_load_aerobic_high: number`、`monthly_load_aerobic_low: number`、`monthly_load_anaerobic: number`、`optimal_chronic_load_max: number`、`optimal_chronic_load_min: number`、`sport: string`、`training_balance_feedback: string`、`training_status: number`、`training_status_feedback: string`、`vo2_max: number`、`vo2_max_precise: number` |
| training_readiness | `acute_load: number`、`context: string`、`date: string`、`feedback: string`、`hrv_factor_feedback: string`、`hrv_factor_percent: number`、`hrv_weekly_avg: number`、`level: string`、`recovery_factor_feedback: string`、`recovery_factor_percent: number`、`recovery_time_hours: number`、`score: number`、`sleep_factor_feedback: string`、`sleep_factor_percent: number`、`sleep_history_factor_percent: number`、`sleep_history_feedback: string`、`sleep_score: number`、`stress_history_factor_percent: number`、`stress_history_feedback: string`、`timestamp: string`、`training_load_factor_percent: number`、`training_load_feedback: string` |
| activities_in_lookback | `avg_hr_bpm: number`、`calories: number`、`distance_meters: number`、`duration_seconds: number`、`id: number`、`max_hr_bpm: number`、`name: string`、`start_time: string`、`steps: number`、`type: string` |

类型只说明实际样本形态，不代表每条记录必须含全部字段。`sleep[].sleep_start`／`sleep_end` 当前为数字时间，`hrv.sleep_start`／`sleep_end` 当前为无时区后缀的时间字符串；不能直接使用同一解析器或依据字段同名推断单位。数字时间应经过明确的单位归一化，当前审计未把其原始值写入本文件。

## 覆盖范围字段

| 字段路径 | 类型 | 子字段 |
| --- | --- | --- |
| 每日.coverage.activities | object | `start`、`end` |
| 每日.coverage.completed_daily_stats | object | `from`、`through`、`count` |
| 每日.coverage.sleep_wake_dates | object | `from`、`through`、`count` |
| 每日.coverage.current_day_stats | object | `date`、`is_partial` |
| 每日.coverage.independent_hrv_date | string | （空数组，当前样本无可推断项结构） |
| 每日.coverage.training_status_date | string | （空数组，当前样本无可推断项结构） |
| 每日.coverage.readiness_returned_timestamps | array | （空数组，当前样本无可推断项结构） |
| 每日.coverage.coach_actual_returned_dates | object | `from`、`through` |
| 每日.coverage.is_full_history_export | boolean | （空数组，当前样本无可推断项结构） |
| 每日质量.actual_data_coverage.activities | object | `start`、`end` |
| 每日质量.actual_data_coverage.completed_daily_stats | object | `from`、`through`、`count` |
| 每日质量.actual_data_coverage.sleep_wake_dates | object | `from`、`through`、`count` |
| 每日质量.actual_data_coverage.current_day_stats | object | `date`、`is_partial` |
| 每日质量.actual_data_coverage.independent_hrv_date | string | （空数组，当前样本无可推断项结构） |
| 每日质量.actual_data_coverage.training_status_date | string | （空数组，当前样本无可推断项结构） |
| 每日质量.actual_data_coverage.readiness_returned_timestamps | array | （空数组，当前样本无可推断项结构） |
| 每日质量.actual_data_coverage.coach_actual_returned_dates | object | `from`、`through` |
| 每日质量.actual_data_coverage.is_full_history_export | boolean | （空数组，当前样本无可推断项结构） |
| 周度.coverage.natural_week | array | （空数组，当前样本无可推断项结构） |
| 周度.coverage.sunday_not_finished | boolean | （空数组，当前样本无可推断项结构） |
| 周度.coverage.activities | object | `from`、`through`、`collected_at` |
| 周度.coverage.complete_daily_stats | object | `from`、`through`、`count` |
| 周度.coverage.sleep_wake_dates | object | `from`、`through`、`count` |
| 周度.coverage.current_day_stats_partial | object | `date`、`collected_at`、`upstream_updated_at` |
| 周度.coverage.next_natural_week_plan | object | `from`、`through`、`unreturned_dates` |
| 周度.coverage.is_full_history_export | boolean | （空数组，当前样本无可推断项结构） |

同日已存在这些字段差异：

| 含义 | 每日 | 周度 |
| --- | --- | --- |
| 完整日常覆盖 | coverage.completed_daily_stats | coverage.complete_daily_stats |
| 当日部分覆盖 | coverage.current_day_stats | coverage.current_day_stats_partial |
| 活动覆盖端点 | coverage.activities.start / end | coverage.activities.from / through；另含 collected_at |
| 教练范围 | coverage.coach_actual_returned_dates | coverage.next_natural_week_plan；另含 unreturned_dates |
| 教练对象 | coach_schedule | coach_schedules[] |
| 活动更正计数 | activity_delta.corrected_activity_count | activity_delta.corrected_count |
| 距离阈值字段 | activity_delta.distance_tolerance_meters | activity_delta.distance_tolerance_m |
| 时长阈值字段 | activity_delta.duration_tolerance_seconds | activity_delta.duration_tolerance_s |
| 活动索引保留信息 | retained_activity_index.count / last_count_source / not_recounted_this_run | activity_delta.retained_index_count / account_total_requeried |
| 当日滞后标记 | current_day_stats.is_possibly_lagged | current_day_stats.is_possibly_lagged_or_different_scope |
| 静息摘要对象 | resting_heart_rate | 当前周度样本无同名顶层对象；日常条目仍含 resting_heart_rate_bpm |
| 教练详情内容 | coach_workout_details[] | coach_workout_detail_reuse[] 指向既有详情，而非重新展开步骤 |

## 日期、采集时间和质量的对应关系

| 字段／组合 | 对应关系 |
| --- | --- |
| archive_date、目录名 | 归档组织日期；不能替代每个指标的数据日期或最后成功采集时间。 |
| collection_window.started_at / completed_at | 本轮采集窗口；观察为含时区后缀的日期时间字符串。 |
| recorded_at | 记录写入时间；与采集窗口分开。当前每日样本存在，周度样本可缺省。 |
| daily_stats[].date + collected_at + is_partial | 指标所属日期、取得时间与完整性分开；完整覆盖范围由 coverage 的完整日常项说明。 |
| current_day_stats.date + collected_at + is_partial | 当日累计中的部分值；与完整日常单独建模。upstream_updated_at 可为 null，不能将采集时间当设备更新时间。 |
| current_day_stats.is_possibly_lagged / is_possibly_lagged_or_different_scope | 滞后／口径可能不同的质量标记，应与该条日期和采集时间同时保留。 |
| sleep[].date + coverage.sleep_wake_dates | 睡眠按醒来日期组织；不能把跨午夜睡眠直接按开始日期归档。sleep[].collected_at 是读取时间。 |
| sleep_stage_duration_mismatches[].date | 关联当晚睡眠所属日期；每日 sleep_seconds 与 stage_sum_seconds 不一致记录单独保留。周度位于 derived_metrics.quality_sleep_stage_diffs[]，字段为 date / diff / sleep_seconds / stage_sum。 |
| hrv.date + collected_at + coverage.independent_hrv_date | 独立 HRV 的数据日期和读取时间；睡眠条目的 avg_overnight_hrv 另有本身的睡眠日期来源，不能因名称相近就覆盖。 |
| resting_heart_rate.date + source + collected_at + independent_interface_skipped | 摘要可能复用同日日常来源；接口被跳过不是缺失或采集失败的同义词。 |
| training_status.date + collected_at + coverage.training_status_date | 训练状态数据日期与读取时间；不能用 archive_date 将旧有效状态冒充当天新状态。 |
| training_readiness[].date + timestamp + context | 同日可有多个状态时点，当前 timestamp 为无时区后缀的时间字符串。training_readiness_collected_at 是整体读取时间，coverage.readiness_returned_timestamps 是返回时点覆盖。 |
| activities_in_lookback[].id + start_time | 活动身份与当地发生时间；当前 start_time 为无时区后缀字符串。该数组是回查窗口，不能视为账户全量或替代累计活动索引。 |
| request_results[].logical_key / date / collected_at / status | 快照内请求结果可按逻辑键、工具参数和日期追溯；日期是请求对象，采集时间是取得时间。 |
| requests[].resolved_at / saved_in_commit 与 archive_verification | 质量文件另区分缺项解决、保存提交和发布回读；请求成功不等于文件已发布，发布成功也不证明其他设备已拉取。 |
| natural_week.start / end、coverage.natural_week、sunday_still_partial / sunday_not_finished | 自然周窗口与结束日尚未完整的质量状态分开；周度报告不是完整历史导出。 |
| coach_schedule.date 或 coach_schedules[].requested_calendar_date | 请求锚点；不等于所有课节的实际安排日期，也不保证返回覆盖完整的下一自然周。 |
| coach_schedule.workouts[].date 或 coach_schedules[].workouts[].date | 每节课／休息日的实际安排日期；与 actual_returned_dates、coverage.next_natural_week_plan.unreturned_dates 共同说明真实覆盖。 |
| coach_workout_detail_reuse[].date / collected_at / snapshot / source / uuid | 复用详情必须保留原取得时间和原快照来源；不能标为本轮新查询成功。 |
| verified_at、archive_verification.verified_at | 发布回读的验收时间；不刷新健康数据采集时间或数据所属日期。 |

`timezone` 与 `unit_system` 为独立上下文字段；保留原值并在边界处明确归一化。这里仅记录字段关系。字段缺省、null、未尝试、失败、旧有效值和“真实无新增”必须分开；不能将空数组或缺字段直接转成零。

## 活动索引与教练计划

| Markdown 文件 | 观察到的表头 |
| --- | --- |
| /Users/lgy/Documents/我的AI档案/运动/活动记录.md | `月份`、`全部活动条数`、`跑步条数（不含跑步机）`、`跑步 km`、`跑步分钟` |
| /Users/lgy/Documents/我的AI档案/运动/活动记录.md | `当地日期时间`、`类型`、`活动名`、`km`、`分钟`、`平均／最高心率 bpm`、`活动 ID` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `实际日期`、`原计划及已有详情` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `实际日期`、`Garmin原计划`、`时长与设备描述` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `实际日期`、`Garmin原计划`、`时长与设备描述`、`与S76同日期快照比较` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `实际日期`、`Garmin原计划`、`时长与设备描述`、`状态` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `实际日期`、`Garmin原计划`、`预计时长与已读取描述`、`状态` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `日期`、`晚间原计划`、`描述／预计时长`、`与今晨差异` |
| /Users/lgy/Documents/我的AI档案/运动/佳明教练计划.md | `日期`、`原课节`、`Garmin 返回的内容`、`恢复训练阶段的调整草案` |
| /Users/lgy/Documents/我的AI档案/运动/同步状态.md | `失败请求`、`北京时间与发生阶段`、`实际尝试／重试`、`处理与数据保留` |
| /Users/lgy/Documents/我的AI档案/运动/同步状态.md | `环节`、`状态` |

`活动记录.md` 同时含按月份汇总表和逐活动表；逐活动表的 `活动 ID` 对应快照 `activities_in_lookback[].id`。表内 `当地日期时间` 与 JSON `start_time` 均需明确时区；`km`／`分钟` 与 JSON 的米／秒字段不同，应有明确换算。累计表包含回查窗口外历史，读者不能以最新 JSON 的回查条数覆盖其累计索引。

教练 Markdown 留存多次日期快照及历史计划，并出现 `恢复训练阶段的调整草案` 表头；这类调整草案和设备原计划应保持来源区分，不能把历史段落或建议自动当作当前 Garmin 安排。当前安排首先依据有来源与采集时间的 JSON 课节日期，再保留 Markdown 的原始历史入口。

| 教练 JSON 字段路径 | 子字段 |
| --- | --- |
| 每日.coach_schedule | `date`、`training_plans`、`count`、`workouts`、`collected_at` |
| 每日.coach_workout_details | `collected_at`、`created_date`、`date`、`description`、`estimated_duration_seconds`、`estimated_training_effect`、`name`、`segment_count`、`segments`、`sport`、`training_effect_label`、`uuid`、`workout_type` |
| 每日.coach_schedule.workouts[] | `completed`、`date`、`estimated_duration_seconds`、`is_rest_day`、`name`、`sport`、`training_plan`、`workout_type`、`workout_uuid` |
| 每日.coach_workout_details[].segments[] | `order`、`sport`、`step_count`、`steps` |
| 每日.coach_workout_details[].segments[].steps[] | `end_condition`、`end_condition_value`、`order`、`target_type`、`target_value_high`、`target_value_low`、`type` |
| 周度.coach_schedules[] | `actual_returned_dates`、`collected_at`、`count`、`date`、`requested_calendar_date`、`training_plans`、`workouts` |
| 周度.coach_workout_detail_reuse[] | `collected_at`、`date`、`reason`、`snapshot`、`source`、`uuid` |
| 周度.coach_schedules[].workouts[] | `completed`、`date`、`estimated_duration_seconds`、`is_rest_day`、`name`、`sport`、`training_plan`、`workout_type`、`workout_uuid` |

`workout_uuid` 是安排到详情的连接键；每日详情使用 `uuid`。课节可能是休息日，只含 `is_rest_day`、`completed` 等部分字段；不要要求休息日必须有名称、运动类型、预计时长或详情。周度复用路径须解析原来源，不能把 `coach_workout_detail_reuse[]` 当作完整详情数组。

## 数据质量与发布验收结构

| 字段路径 | 子字段 |
| --- | --- |
| 每日.connection | `github_read_success`、`repository_visibility`、`garmin_preflight_success`、`unit_system` |
| 每日.counts | `garmin_read_attempts`、`preflight_attempts`、`data_requests_attempted`、`data_requests_successful`、`original_scope_requests`、`dependent_coach_details`、`failures`、`retries`、`extra_session_health_checks`、`original_items_resolved`、`dependent_items_resolved`、`remaining_pending` |
| 每日.attempts[] | `attempt`、`duration_seconds`、`error`、`finished_at`、`logical_key`、`parameters`、`retry_number`、`role`、`started_at`、`status`、`tool` |
| 每日.requests[] | `attempt_count`、`collected_at`、`date`、`last_attempt_at`、`logical_key`、`parameters`、`purpose`、`resolved_at`、`saved_in_commit`、`status`、`tool` |
| 每日.archive_verification | `status`、`branch`、`use_current_parent`、`expected_sha_required`、`force`、`post_publish_per_file_readback_required`、`verified_at`、`data_commit_sha`、`files_verified_against_data_commit`、`note` |
| 周度.tool_calls[] | `attempt`、`completed_at`、`duration_seconds`、`parameters`、`started_at`、`status`、`tool` |
| 周度.comparisons | `historical_required_fields_changed`、`activity_new_count`、`activity_corrected_count`、`schedule_matches_S102`、`detail_queries_this_run`、`detail_reuse_source` |
| 周度.archive_publication | `target`、`branch`、`base_commit`、`force`、`expected_sha_required`、`verification_receipt`、`verification_method` |
| 周度发布验收.natural_week | `start`、`end`、`sunday_still_partial` |
| 周度发布验收.publication | `expected_sha`、`force`、`update_ref_confirmed` |
| 周度发布验收.files[] | `blob_sha`、`exact_content_match`、`path` |
| 周度发布验收.garmin_read_requests | `total`、`success`、`failed`、`retried` |
| 周度发布验收.collection_window | `started_at`、`completed_at` |
| 周度发布验收.checks | `activity_ids_deduplicated`、`historical_required_fields_changed`、`original_week_mid_report_body_preserved`、`all_relative_link_targets_present_in_repository_or_this_receipt`、`stable_memory_unchanged`、`subjective_log_unchanged`、`pending_queue_unchanged` |

每日 `来源与质量.json.actual_data_coverage` 与对应快照 `coverage` 同义；`snapshot_path` 指向它评价的快照。周度质量用 `tool_calls[]`，每日质量用 `attempts[]` 与 `requests[]`，字段并非相同。`error`／`quality_flags`／`note` 可能含自由文本；此次未导出其正文。

发布验收文件的 `files[].path / blob_sha / exact_content_match` 评价归档回读；`data_commit`、`head_at_readback`、`readback_ref` 用于追溯发布版本。它与 Garmin 读取成功、健康数据新鲜度及 `other_device_pull_verified` 是不同维度。

`同步状态.md` 是按新旧采集事件保留的 Markdown 历史，当前最新段落链接到周度快照、质量及发布验收文件。不能从任一较旧标题或历史“失败／已暂停”字样推断当前状态；应保留段落日期并优先使用相关机器可读质量、队列及验收来源。

## 缺项队列结构（仅元数据）

| 字段路径 | 子字段 |
| --- | --- |
| 根对象 | `schema_version`、`timezone`、`updated_at`、`primary_task`、`recovery_task`、`assessment`、`pending`、`resolved_items`、`metric_coverage_notes`、`last_recovery_run`、`automation_config_readback_verified`、`future_scheduled_run_verified`、`limits`、`pending_item_required_fields`、`notification_policy`、`assessment_history`、`last_primary_run`、`recovery_run_history`、`primary_run_history` |
| pending[] | （空数组，当前样本无可推断项结构） |
| resolved_items[] | `acquired_at`、`acquired_source`、`attempt_count`、`collection_run_id`、`covers_metrics`、`data_collected_at`、`date`、`dependent_detail_requests`、`initial_missing_reason`、`last_attempt_at`、`last_preflight_failure_at`、`last_primary_run_id`、`last_recovery_connection_status`、`last_recovery_run_id`、`last_valid_source`、`logical_key`、`missing_reason`、`missing_reason_at_detection`、`parameters`、`parent_logical_key`、`priority`、`purpose`、`resolution_run_id`、`resolved_at`、`saved_in_commit`、`snapshot_path`、`source`、`status`、`tool`、`verified_at`、`verified_snapshot_blob_sha` |
| last_recovery_run | `run_id`、`sync_date`、`started_at`、`finished_at`、`status`、`source`、`quality_path`、`snapshot_path`、`record_restored_at`、`preflight_attempts`、`data_requests_attempted`、`data_requests_successful`、`new_api_calls_during_restoration`、`original_scope_requests`、`dependent_details`、`note`、`archive_verified_at`、`data_saved_in_commit`、`items_resolved`、`original_items_resolved`、`dependent_items_resolved`、`remaining_pending` |
| last_primary_run | `date`、`run_id`、`started_at`、`finished_at`、`status`、`source`、`preflight_attempts`、`data_requests_attempted`、`data_requests_successful`、`pending_count`、`quality_path`、`snapshot_path`、`archive_verified_at`、`data_saved_in_commit`、`original_scope_requests`、`dependent_details` |
| assessment_history[] | `all_known_gaps_resolved`、`archive_readback_verified_at`、`basis_sources`、`data_commit_sha`、`latest_full_category_collection_date`、`morning_quality`、`morning_run_recorded_status`、`morning_snapshot`、`note`、`sync_date`、`targeted_backfill` |
| recovery_run_history[] | `archive_verified_at`、`data_requests_attempted`、`data_requests_successful`、`data_saved_in_commit`、`dependent_details`、`dependent_items_collected`、`dependent_items_resolved`、`extra_session_health_checks`、`finished_at`、`items_resolved`、`new_api_calls_during_restoration`、`note`、`original_items_collected`、`original_items_resolved`、`original_scope_requests`、`preflight_attempts`、`quality_path`、`record_restored_at`、`remaining_pending`、`run_id`、`snapshot_path`、`source`、`started_at`、`status`、`sync_date` |
| primary_run_history[] | `data_requests_attempted`、`date`、`finished_at`、`last_data_success_at`、`last_data_success_source`、`pending_count`、`preflight_attempts`、`quality_path`、`run_id`、`source`、`started_at`、`status` |

缺项条目的 `logical_key`／`date`／`tool`／`parameters` 标识请求；`status`、尝试次数与 `last_attempt_at` 描述执行状态。`last_valid_source` 内的 `date`、`collected_at`、`path`／`source` 指向旧有效资料；该日期不可因新的失败尝试而变新。若条目含 `resolved_at`、`data_collected_at`、`saved_in_commit`、`verified_at` 和 `verified_snapshot_blob_sha`，应分别保留采集、解决、保存和回读证据。空待补队列不能单独证明当天采集成功。

## 本次完整性边界

以上是当前日目录与指定索引／计划／状态的去值结构审计。未读取其他日期 JSON 正文，未运行任何采集、同步或迁移入口。T15 的自动化测试应从这些字段定义创建合成样例，不把真实健康数据复制进工程或测试夹具。
