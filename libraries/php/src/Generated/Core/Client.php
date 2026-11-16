<?php

namespace Voidhash\Generated\Core;

class Client extends \Voidhash\Generated\Core\Runtime\Client\Client
{
    /**
     * Lists the project's connected ad accounts with their sync status. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAccountsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function adAccountsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdAccountsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Connects a Meta ad account with a system user access token. The token must grant `ads_read` and reach the account; the account's name, currency and time zone come from Meta. The token is stored encrypted and never returned, and the first sync starts right away. Connecting an account that is connected already replaces its token and resumes a stopped sync; it answers 201 with the same account. Fails with `invalid_request` (`ad_account_rejected`) when Meta rejects the token or the account, and `message` says what to change. Needs `project:ads:manage`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\ConnectAdAccountBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdAccountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adAccountsCreate(string $projectId, \Voidhash\Generated\Core\Model\ConnectAdAccountBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdAccountsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Disconnects an ad account and deletes its synced campaigns, ad groups, ads and spend. Fails with `not_found` (`ad_account_not_found`). Needs `project:ads:manage`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $adAccountId The connected ad account's id in Voidhash, `ad_acct_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function adAccountsDelete(string $projectId, string $adAccountId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdAccountsDelete($projectId, $adAccountId), $fetch);
    }
    /**
     * Reads one connected ad account. Fails with `not_found` (`ad_account_not_found`). Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $adAccountId The connected ad account's id in Voidhash, `ad_acct_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdAccountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adAccountsGet(string $projectId, string $adAccountId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdAccountsGet($projectId, $adAccountId), $fetch);
    }
    /**
     * Checks an access token with Meta and lists the ad accounts it can read, suggested ones first, marking those this project already connected. The token is used for these reads only and not stored; connect accounts with `POST /ads/accounts`. A token without `ads_read` lists no accounts. Fails with `invalid_request` (`ad_account_rejected`) when Meta rejects the token, with `param` set to `accessToken`. Safe to repeat. Needs `project:ads:manage`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\QueryAvailableAdAccountsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsQueryAvailableBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsQueryAvailableUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsQueryAvailableForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsQueryAvailableNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdAccountsQueryAvailableInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adAccountsQueryAvailable(string $projectId, \Voidhash\Generated\Core\Model\QueryAvailableAdAccountsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdAccountsQueryAvailable($projectId, $requestBody), $fetch);
    }
    /**
     * Computes up to 20 of the built-in insights (revenue, MRR, churn, trials, persons, retention and more) over a time range, each with an optional filter, breakdown and granularity. Each result carries the caller's `key` and the absolute time range it covered. A monetary insight reports in the organization's reporting currency (USD until one is chosen in its settings), names it in `summary.currency`, and gives its amounts in integer minor units of it, such as cents. A secret key reports its own environment's events and revenue; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `invalid_request` (`unknown_insight`, `unsupported_filter`, `unsupported_breakdown`, `invalid_time_range` or `invalid_report_request`) with a message saying what to change.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\InsightsReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportInsightsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportInsightsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportInsightsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportInsightsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportInsightsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\InsightsReportResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportInsights(string $projectId, \Voidhash\Generated\Core\Model\InsightsReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportInsights($projectId, $requestBody), $fetch);
    }
    /**
     * Computes up to 20 of the built-in charts over a time range: revenue, subscribers, trials, churn, audience, paywalls, acquisition, web, app, locations, push and data health. Each result carries the caller's `key`, the absolute range it covered and a `shape` saying how to read it: `series`, `table`, `funnel`, `cohorts`, `curves`, `histogram`, `heatmap`, `flow`, `stats`, `points`, `markers` or `options`. Money is in integer minor units of `currency`, the organization's reporting currency. A chart reads only the filters and options that apply to it. A secret key reports its own environment; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `invalid_request` (`invalid_report_request` or `invalid_time_range`) with a message saying what to change.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\ChartsReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportChartsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportChartsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportChartsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportChartsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportChartsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ChartsReportResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportCharts(string $projectId, \Voidhash\Generated\Core\Model\ChartsReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportCharts($projectId, $requestBody), $fetch);
    }
    /**
     * Measures up to 20 metrics over a time range, each narrowed by filters and split into groups: MRR, revenue, or the count or unique people of one of your events, by store, product, billing period, plan, a person's trait (grouped into `bins` when it is a number) or an event property. MRR and revenue count what the built-in charts count, so a split's groups add up to its `total`. A trait or plan is taken as it stood at the time: when an event or charge happened, or at the end of each period for MRR. Rows without a value form the `$unknown` group. When a query reads a trait, a group of fewer than five people is summed under `$other`, and a result narrowed below five people is withheld. Money is in integer minor units of `currency`, the organization's reporting currency. A secret key reports its own environment; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `invalid_request` (`invalid_report_request` or `invalid_time_range`) with a message saying what to change.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\MetricsReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\MetricsReportResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportMetrics(string $projectId, \Voidhash\Generated\Core\Model\MetricsReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportMetrics($projectId, $requestBody), $fetch);
    }
    /**
     * Lists who is behind one point of a metric query's result: the people (or, for `unique_groups`, the groups) whose rows made that bucket's value, of the total or of one group of the split, read by the same query, filters and split as the point. People are listed with the events they sent in the bucket (`unique_sessions`: their sessions; `property`: the statistic of their numbers; active people: their events in the window), revenue with what each paid net of refunds, and MRR with each person's MRR at the bucket's end, money in integer minor units of `currency`. A count of people or groups has as many actors as its value, and what adds up sums to it. A cumulative query's point reads from the range's start. Pages run by `value`, most first, then by key; `total` counts the point's actors. People need the `project:persons:read` permission as well as `project:analytics:read`; groups need analytics read alone. Fails with `invalid_request` (`invalid_report_request` or `invalid_time_range`) with a message saying what to change, such as a `bucketStart` that is not one of the result's buckets.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportMetricActorsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\MetricActorsReportResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportMetricActors(string $projectId, \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportMetricActors($projectId, $requestBody), $fetch);
    }
    /**
     * Groups the people a network, campaign, ad set or ad brought in, or people by the surface they signed up on (web, iOS or Android), and reports what Voidhash measured for them on the web and in apps: visits, signups, measured app installs, trials, payers, revenue and refunds in one currency, the funnel by surface, where payers converted and the project's revenue coverage by credited touch. A signup is credited to the person's last touch with an ad network before it within the attribution window (the project's, unless `attributionWindowDays` overrides it), else to their last touch of any kind in that time, or to a touch up to an hour after it; a signup without one is unattributed. The person is acquired on that touch's day and their later revenue stays with it. People count from the earliest of signing up and first paying or starting a trial, so someone who buys and creates an account later stays with the touch before the purchase; other anonymous visitors count only as visits. Revenue counts once on the person an identify merge keeps, wherever they pay, and only production revenue counts by default. Money is in integer minor units of `currency`, such as cents.
     *
     * People a touch reached only after they had signed up, such as customers reached by retargeting, are reported only as `returningPeople`, `returningPayers` and `returningRevenue`, which are never part of other revenue. `selfReported` lists what at least 2 unattributed people answered in the `$acquisition_source` person trait. Fails with `invalid_request` (`invalid_report_request`) for a request over the size limits or in a currency without exchange rates for the period, with a message saying what to change, and `invalid_request` (`invalid_time_range`) for a bad range.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportAcquisition(string $projectId, \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportAcquisition($projectId, $requestBody), $fetch);
    }
    /**
     * Weekly cohorts of the people a touch acquired, by acquisition date (the day of the touch credited with each signup, within the attribution window), grouped by surface, network, campaign or ad set: cumulative signups, payers and revenue by day 0, 1, 3, 7, 14, 30, 60, 90, 180, 365 and 730 after each person's touch, each `complete` or still `maturing`, with projections of the net revenue still to come. Money is in integer minor units of `currency`. Fails with `invalid_request` (`invalid_report_request` or `invalid_time_range`) and a message saying what to change.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AcquisitionCohortsReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionCohortsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionCohortsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionCohortsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionCohortsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionCohortsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportAcquisitionCohorts(string $projectId, \Voidhash\Generated\Core\Model\AcquisitionCohortsReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportAcquisitionCohorts($projectId, $requestBody), $fetch);
    }
    /**
     * What measuring the project's ads relies on, from the last seven days: hosts with web page views, the iOS and Android SDKs and versions that reported events, and how many app users were first identified or touched on the web. Takes no options.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportTrackingHealthBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportTrackingHealthUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportTrackingHealthForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportTrackingHealthNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportTrackingHealthInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportTrackingHealth(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportTrackingHealth($projectId), $fetch);
    }
    /**
     * Who is here now: the people who opened or returned to the project's apps (`$app_opened`, `$app_became_active`), and the people who viewed one of its web pages (`$pageview`), within the last `windowMinutes`. Someone on both counts once in each. `locations` places people in whole degrees of latitude and longitude, the coarseness of a region; `users` also counts people whose events carry no location, so it can exceed the sum of `locations`. Reads production events unless the credential names another environment, as for insights. On a self-hosted server, these events count only after they are turned on in the project's ingest policy. Takes no options.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\LiveUsersResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsReportLiveUsers(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsReportLiveUsers($projectId), $fetch);
    }
    /**
     * Lists the project's alerts, each with how it stood at its latest hourly check. Fails with `invalid_request` (`invalid_cursor`) for a cursor from another list.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsAlertsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsAlertsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsAlertsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates an alert, first checked at the next quarter past the hour. Fails with `invalid_request` (`invalid_analytics_alert`) for a rule that could not run, or a project already at 25 alerts.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsAlertsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsAlertsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes an alert and ends any open notice of it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $alertId The alert's id, `alert_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsAlertsDelete(string $projectId, string $alertId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsAlertsDelete($projectId, $alertId), $fetch);
    }
    /**
     * Reads one alert. Fails with `not_found` (`analytics_alert_not_found`) when the project has no such alert.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $alertId The alert's id, `alert_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsAlertsGet(string $projectId, string $alertId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsAlertsGet($projectId, $alertId), $fetch);
    }
    /**
     * Changes an alert. Changing what it watches, or turning it on or off, starts it over at `pending` and ends any open notice; a new name does not. Its `kind` cannot change.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $alertId The alert's id, `alert_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsAlertsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsAlertsUpdate(string $projectId, string $alertId, \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsAlertsUpdate($projectId, $alertId, $requestBody), $fetch);
    }
    /**
     * Lists the project's cohorts, most recently changed first. A dynamic cohort's `memberCount` is null here; read it alone to count its people. Fails with `invalid_request` (`invalid_cursor`) for a cursor from another list.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsCohortsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a cohort: a static one with its first people, or a dynamic one with its definition. Fails with `invalid_request` (`invalid_analytics_cohort`) for a definition that can't run, such as one naming a cohort of another project or naming cohorts in a circle, or people who aren't current people of the project.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateAnalyticsCohortBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsCreateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsCreateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsCohortJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateAnalyticsCohortBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Works out who a dynamic cohort's definition holds now, without saving it: how many people, and the first of them. Fails with `invalid_request` (`invalid_analytics_cohort`) for a definition that can't run.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\EvaluateAnalyticsCohortBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsEvaluateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsEvaluateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsEvaluateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsEvaluateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsEvaluateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsEvaluateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsCohortEvaluationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsEvaluate(string $projectId, \Voidhash\Generated\Core\Model\EvaluateAnalyticsCohortBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsEvaluate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a cohort. Insights, charts and automations that name it no longer can; a dynamic cohort that names it fails until it is changed.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsDeleteInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsDeleteServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsDelete(string $projectId, string $cohortId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsDelete($projectId, $cohortId), $fetch);
    }
    /**
     * Reads one cohort, with how many people it holds now. Fails with `not_found` (`analytics_cohort_not_found`) when the project has no such cohort.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsGetInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsGetServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsCohortJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsGet(string $projectId, string $cohortId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsGet($projectId, $cohortId), $fetch);
    }
    /**
     * Renames a cohort, changes its description, or gives a dynamic cohort a new definition. A static cohort's people change with `addPeople` and `removePerson`. Its kind never changes.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateAnalyticsCohortBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsUpdateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsCohortJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsUpdate(string $projectId, string $cohortId, \Voidhash\Generated\Core\Model\UpdateAnalyticsCohortBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsUpdate($projectId, $cohortId, $requestBody), $fetch);
    }
    /**
     * Lists the people a cohort holds now, newest first: a static cohort's people, or whoever matches a dynamic cohort's definition. Needs `project:persons:read` as well. Fails with `invalid_request` (`invalid_analytics_cohort`) for a dynamic cohort whose definition can't run, such as one naming a cohort since deleted, or a cursor from another list.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "search"?: string, //Only people whose name, email or distinct id contains this, ignoring case.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListPeopleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListPeopleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListPeopleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListPeopleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListPeopleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsListPeopleServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsCohortsCohortIdPeopleGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsListPeople(string $projectId, string $cohortId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsListPeople($projectId, $cohortId, $queryParameters), $fetch);
    }
    /**
     * Adds people to a static cohort, by person id, distinct id or email; people already in it stay as they are. Identifiers no current person of the project has are returned in `unresolved`. Fails with `invalid_request` (`invalid_analytics_cohort`) for a dynamic cohort.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsAddPeopleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsAddPeopleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsAddPeopleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsAddPeopleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsAddPeopleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsAddPeopleServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsAddPeople(string $projectId, string $cohortId, \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsAddPeople($projectId, $cohortId, $requestBody), $fetch);
    }
    /**
     * Takes a person out of a static cohort; a person who isn't in it changes nothing. Fails with `invalid_request` (`invalid_analytics_cohort`) for a dynamic cohort.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param string $personId The person's id, `person_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsCohortsRemovePerson(string $projectId, string $cohortId, string $personId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsCohortsRemovePerson($projectId, $cohortId, $personId), $fetch);
    }
    /**
     * Lists the project's group types, in the order events first named them. A project has at most 5.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupTypesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupTypesList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupTypesList($projectId, $queryParameters), $fetch);
    }
    /**
     * Names a group type as Studio shows it, such as `Team` and `Teams` for `company`. Its key never changes. Fails with `not_found` (`analytics_group_type_not_found`) when the project has no such group type.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupTypeId The group type's id, `an_group_type_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsGroupTypeJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupTypesUpdate(string $projectId, string $groupTypeId, \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupTypesUpdate($projectId, $groupTypeId, $requestBody), $fetch);
    }
    /**
     * Lists one group type's groups, most recently seen first; `key` finds one group by the key events name it with. Fails with `invalid_request` (`invalid_cursor`) for a cursor from another list.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "groupType": string, //The group type whose groups to list, by its key, such as `organization`.
     *    "key"?: string, //Only the group with this key; the page then holds at most one.
     *    "search"?: string, //Only groups whose key or `name` property contains this, ignoring case.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Deletes a group and its properties. Its events stay, still naming its key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupId The group's id, `an_group_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupsDelete(string $projectId, string $groupId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupsDelete($projectId, $groupId), $fetch);
    }
    /**
     * Reads one group with its current properties. Fails with `not_found` (`analytics_group_not_found`) when the project has no such group.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupId The group's id, `an_group_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsGetInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsGetServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsGroupJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupsGet(string $projectId, string $groupId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupsGet($projectId, $groupId), $fetch);
    }
    /**
     * Sets, sets once or removes a group's properties, as a `$groupidentify` event does, so a server can keep what it knows, such as an organization's plan and seats, on the group. Values are flat: text, numbers and booleans.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupId The group's id, `an_group_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsUpdateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AnalyticsGroupJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupsUpdate(string $projectId, string $groupId, \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupsUpdate($projectId, $groupId, $requestBody), $fetch);
    }
    /**
     * Lists the people who sent events naming the group in the last `days` days, most active first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupId The group's id, `an_group_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "days"?: int, //The days, ending now, whose events tie people to the group, 1 to 365. Defaults to 30.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListPeopleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListPeopleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListPeopleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListPeopleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListPeopleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsListPeopleServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupsGroupIdPeopleGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsGroupsListPeople(string $projectId, string $groupId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsGroupsListPeople($projectId, $groupId, $queryParameters), $fetch);
    }
    /**
     * Lists the project's keys, publishable first, optionally only one `type`. A secret key's own value is never listed.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "type"?: string, //Only keys of this type: `publishable` or `secret`.
     *    "environment"?: string, //Only keys for this environment: `production` or `test`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdApiKeysGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a secret key, optionally limited to some project permissions and given an expiry. The response is the only time its `rawKey` is shown. A key cannot carry a permission its creator lacks. Only a person signed in to the Voidhash dashboard can do this; a secret key, a CLI key or an MCP client cannot. Fails with `invalid_request` (`expiry_not_in_future`) for an expiry that has passed.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateApiKeyBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateApiKeyBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a secret key; requests made with it fail from then on. Only a person signed in to the Voidhash dashboard can do this; a secret key, a CLI key or an MCP client cannot. Fails with `invalid_request` (`publishable_key_not_editable`) for a publishable key, which apps already ship with.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $apiKeyId The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysDelete(string $projectId, string $apiKeyId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysDelete($projectId, $apiKeyId), $fetch);
    }
    /**
     * Reads one key. A secret key's own value is never shown.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $apiKeyId The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysGet(string $projectId, string $apiKeyId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysGet($projectId, $apiKeyId), $fetch);
    }
    /**
     * Replaces a secret key's project permissions, keeping its secret; `null` gives it full access. The editor must hold every permission the key has before and after the change. Only a person signed in to the Voidhash dashboard can do this; a secret key, a CLI key or an MCP client cannot. Fails with `invalid_request` (`publishable_key_not_editable`) for a publishable key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $apiKeyId The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     * @param \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysUpdate(string $projectId, string $apiKeyId, \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysUpdate($projectId, $apiKeyId, $requestBody), $fetch);
    }
    /**
     * Issues a new secret for a secret key, keeping its id, name, permissions and expiry, and returns it in `rawKey`, shown only this once. The previous secret stops working at once, or after `overlapSeconds`. Only a person signed in to the Voidhash dashboard can do this; a secret key, a CLI key or an MCP client cannot. Fails with `invalid_request` (`publishable_key_not_editable`) for a publishable key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $apiKeyId The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     * @param \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysRotate(string $projectId, string $apiKeyId, \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysRotate($projectId, $apiKeyId, $requestBody), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SessionDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SessionDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SessionDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SessionDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function sessionDelete(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SessionDelete(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SessionGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SessionGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SessionGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SessionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sessionGet(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SessionGet(), $fetch);
    }
    /**
     * Lists your active dev sessions in the project. Only a person can use dev sessions; a project secret key gets `permission_denied` (`person_credential_required`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentDevSessionsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentDevSessionsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentDevSessionsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Registers a run, replacing your previous session in the project: its server's loopback origin (`http://127.0.0.1:<port>`), its random token and the components it serves. Only a person who may change the project's paywalls can do this. Fails with `invalid_request` (`invalid_dev_session`) naming every problem.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateDevSessionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\DevSessionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentDevSessionsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateDevSessionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentDevSessionsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Ends a session, as a run does when it stops. Ending a session that already ended, expired or was replaced changes nothing.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $devSessionId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function componentDevSessionsDelete(string $projectId, string $devSessionId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentDevSessionsDelete($projectId, $devSessionId), $fetch);
    }
    /**
     * Reads one of your active dev sessions. Fails with `not_found` (`dev_session_not_found`) once it expired, ended or was replaced.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $devSessionId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\DevSessionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentDevSessionsGet(string $projectId, string $devSessionId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentDevSessionsGet($projectId, $devSessionId), $fetch);
    }
    /**
     * The run's heartbeat: records the components it serves now and extends the session. Fails with `not_found` (`dev_session_not_found`) once the session expired, ended or was replaced, and `invalid_request` (`invalid_dev_session`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $devSessionId
     * @param \Voidhash\Generated\Core\Model\UpdateDevSessionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentDevSessionsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\DevSessionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentDevSessionsUpdate(string $projectId, string $devSessionId, \Voidhash\Generated\Core\Model\UpdateDevSessionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentDevSessionsUpdate($projectId, $devSessionId, $requestBody), $fetch);
    }
    /**
     * Reads the publisher of the project's organization. Fails with `not_found` (`publisher_not_found`) until an organization admin claims a namespace.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetPublisherBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetPublisherUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetPublisherForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetPublisherNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetPublisherInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\RegistryPublisherJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryGetPublisher(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryGetPublisher($projectId), $fetch);
    }
    /**
     * Claims a namespace for the project's organization, or renames it before anything is published; claiming the current namespace again changes nothing. Only a person who is an organization admin can do this. A namespace has lowercase letters, digits and dashes, at most 39 characters, and `core`, `project`, `voidhash` and `vh` are reserved. Fails with `invalid_request` (`invalid_namespace`) for any other namespace. Fails with `conflict` (`namespace_taken`) when another organization has the namespace, and `conflict` (`namespace_in_use`) when components are already published under the current one.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpsertRegistryPublisherBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpsertPublisherBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpsertPublisherUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpsertPublisherForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpsertPublisherNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpsertPublisherConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpsertPublisherInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\RegistryPublisherJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryUpsertPublisher(string $projectId, \Voidhash\Generated\Core\Model\UpsertRegistryPublisherBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryUpsertPublisher($projectId, $requestBody), $fetch);
    }
    /**
     * Lists the components of the organization's registry, with this project's install of each, or the one with a `slug` (`<publisher>/<name>`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "slug"?: string, //Only the component with this full name, `<publisher>/<name>`; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdRegistryComponentsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryList($projectId, $queryParameters), $fetch);
    }
    /**
     * Publishes a component bundle as a new version, creating the registry component, owned by this project, on its first version. The bundle must pass the automated checks: the definition schema, the module and its agreement with the definition, size limits, the panel module when the definition declares one, and the conformance suite. Fails with `invalid_request` (`conformance_failed`) when the conformance suite fails, and `invalid_request` (`invalid_bundle`) when another check fails. Only people who may publish paywalls in the owner project, and organization admins, can publish versions of an existing component. Publishing the same bundle again returns the existing version. Fails with `conflict` (`publisher_required`) before a namespace is claimed, `conflict` (`version_already_published`) when the version exists with other contents, and `unavailable` (`component_checks_unavailable`) when the conformance checks could not run.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromBundleServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryCreateVersionFromBundle(string $projectId, \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryCreateVersionFromBundle($projectId, $requestBody), $fetch);
    }
    /**
     * Publishes a ready version of one of the project's own components to the organization's registry, sharing its module and editor panel. Fails with `not_found` (`component_version_not_found`) unless the version is ready and its component exists, `invalid_request` (`invalid_component_version`, `conformance_failed`), and like publishing a bundle with `conflict` (`publisher_required`, `version_already_published`) and `unavailable` (`component_checks_unavailable`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePublishedComponentPromotionVersionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateVersionFromComponentServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryCreateVersionFromComponent(string $projectId, \Voidhash\Generated\Core\Model\CreatePublishedComponentPromotionVersionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryCreateVersionFromComponent($projectId, $requestBody), $fetch);
    }
    /**
     * Reads one registry component. Fails with `not_found` (`registry_component_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryGet(string $projectId, string $registryComponentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryGet($projectId, $registryComponentId), $fetch);
    }
    /**
     * Deprecates a whole component (no new installs or inserts) with an optional `deprecationMessage`, or lifts it; only people who may publish paywalls in the owner project, and organization admins, can. `ownerProjectId` transfers the component to another project of the organization, whose people who may publish paywalls can then publish, deprecate and yank; only a person who is an organization admin can transfer. Fails with `not_found` (`registry_component_not_found`) and `invalid_request` (`invalid_owner_project`) for an owner project outside the organization, and `invalid_request` (`deprecation_message_without_deprecation`) for a deprecation message without a deprecation.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryUpdate(string $projectId, string $registryComponentId, \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryUpdate($projectId, $registryComponentId, $requestBody), $fetch);
    }
    /**
     * Lists a registry component's versions, newest first by semantic version, with where each is used across the organization, or the one published as `version`. Fails with `not_found` (`registry_component_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "version"?: string, //Only the version published as this semantic version; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListVersionsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListVersionsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListVersionsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListVersionsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListVersionsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdRegistryComponentsRegistryComponentIdVersionsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryListVersions(string $projectId, string $registryComponentId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryListVersions($projectId, $registryComponentId, $queryParameters), $fetch);
    }
    /**
     * Reads one version of a registry component. Fails with `not_found` (`registry_component_not_found`, `registry_component_version_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param string $versionId The id of the registry component's version, `cmp_pkg_ver_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryGetVersion(string $projectId, string $registryComponentId, string $versionId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryGetVersion($projectId, $registryComponentId, $versionId), $fetch);
    }
    /**
     * Deprecates (`status: deprecated`), restores (`ready`) or yanks (`yanked`) a version, with an optional `statusMessage` for installers. Deprecated and yanked versions cannot be newly installed, inserted or published; paywalls already published with them keep working. Only people who may publish paywalls in the owner project, and organization admins, can. Fails with `not_found` (`registry_component_version_not_found`) and `conflict` (`version_yanked`) when restoring or deprecating a yanked version: a yank is final.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param string $versionId The id of the registry component's version, `cmp_pkg_ver_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryUpdateVersion(string $projectId, string $registryComponentId, string $versionId, \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryUpdateVersion($projectId, $registryComponentId, $versionId, $requestBody), $fetch);
    }
    /**
     * Reads a file the version `versionId` ships, base64 encoded: its `icon`, a preview `thumbnail` (`state` names which), its `readme` or its `agent_guide`. Fails with `not_found` (`registry_component_version_not_found`), and `not_found` (`registry_component_file_not_found`) when the version has no such file.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param string $file Which file to read: `icon`, `thumbnail`, `readme` or `agent_guide`.
     * @param array{
     *    "versionId": string, //The id of the version whose file to read, `cmp_pkg_ver_...`.
     *    "state"?: string, //For a `thumbnail`, the preview state it shows; one of the version's `thumbnailStates`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetVersionFileInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentFileJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryGetVersionFile(string $projectId, string $registryComponentId, string $file, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryGetVersionFile($projectId, $registryComponentId, $file, $queryParameters), $fetch);
    }
    /**
     * Shows what installing the component into the project, or updating its install, would do: the version the range resolves to, the capabilities it adds, and the props and events it adds, removes or changes. Nothing changes. Fails with `invalid_request` (`invalid_version_range`) and `conflict` (`no_matching_version`, `no_installable_version`, `registry_component_deprecated`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $registryComponentId The registry component's id, `cmp_pkg_...`.
     * @param array{
     *    "versionRange"?: string, //The version range to review: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to the install's range, or for a new install `^` the newest ready version.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallReviewInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryGetInstallReview(string $projectId, string $registryComponentId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryGetInstallReview($projectId, $registryComponentId, $queryParameters), $fetch);
    }
    /**
     * Lists the registry components installed in the project, with the version updating each would move to (`availableUpdate`, null when current).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListInstallsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListInstallsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListInstallsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListInstallsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryListInstallsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentInstallsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryListInstalls(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryListInstalls($projectId, $queryParameters), $fetch);
    }
    /**
     * Installs a registry component into the project at the newest ready version in `versionRange`. Fails with `conflict` (`consent_required`), changing nothing, until `consent` accepts the reviewed version and every capability it asks for (see the install review). Also fails with `not_found` (`registry_component_not_found`), `invalid_request` (`invalid_version_range`) and `conflict` (`already_installed`, `registry_component_deprecated`, `no_matching_version`, `no_installable_version`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePublishedComponentInstallBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateInstallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateInstallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateInstallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateInstallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateInstallConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryCreateInstallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryCreateInstall(string $projectId, \Voidhash\Generated\Core\Model\CreatePublishedComponentInstallBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryCreateInstall($projectId, $requestBody), $fetch);
    }
    /**
     * Uninstalls a registry component from the project. Published paywalls keep working; paywalls that still place it cannot be published again until it is installed again. Fails with `not_found` (`component_install_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $installId The install's id, `cmp_inst_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryDeleteInstall(string $projectId, string $installId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryDeleteInstall($projectId, $installId), $fetch);
    }
    /**
     * Reads one install. Fails with `not_found` (`component_install_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $installId The install's id, `cmp_inst_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryGetInstallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryGetInstall(string $projectId, string $installId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryGetInstall($projectId, $installId), $fetch);
    }
    /**
     * Moves an install to the newest ready version in its range, or in a new `versionRange`. Placed instances keep their version until they are moved. Fails with `not_found` (`component_install_not_found`) and like installing with `conflict` (`consent_required`, `no_matching_version`, `no_installable_version`) and `invalid_request` (`invalid_version_range`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $installId The install's id, `cmp_inst_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePublishedComponentInstallBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInstallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInstallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInstallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInstallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInstallConflictException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryUpdateInstallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentRegistryUpdateInstall(string $projectId, string $installId, \Voidhash\Generated\Core\Model\UpdatePublishedComponentInstallBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentRegistryUpdateInstall($projectId, $installId, $requestBody), $fetch);
    }
    /**
     * Lists the project's components with their newest and newest ready version, or the one with a `slug`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "slug"?: string, //Only the component with this slug; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Uploads a prebuilt module as a new `ready` version of the component its `slug` names, creating the component on its first upload. The module must be a WebAssembly binary of at most 2 MiB carrying a valid `vh.manifest` section (a guest ABI 1 manifest or an ABI 2 component definition); a definition that declares an editor panel needs its panel module in `panelBase64`. Without a `slug` the manifest's name is used. A version that fails the conformance checks is kept so its findings can be read, but cannot be placed. Fails with `invalid_request` (`invalid_slug`, `invalid_module`, `invalid_panel_module`) naming every problem, and `unavailable` (`component_checks_unavailable`) when the conformance checks could not run; nothing is stored then, so try again.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsCreateVersionFromModule(string $projectId, \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsCreateVersionFromModule($projectId, $requestBody), $fetch);
    }
    /**
     * Submits a Rust crate as a new version of the component its `slug` names, creating the component on its first version, and answers 202 while the server builds it in the background. The version starts `queued`; read it with `getVersion` until it is `ready` or `failed`. Fails with `invalid_request` (`invalid_slug`, `invalid_source`) naming every problem with the slug or the crate.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallComponentSourceVersionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromSourceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromSourceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromSourceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromSourceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromSourceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsCreateVersionFromSource(string $projectId, \Voidhash\Generated\Core\Model\CreatePaywallComponentSourceVersionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsCreateVersionFromSource($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a component: it is no longer listed and can no longer be inserted or published. Published paywalls keep working, and a new version under the same slug brings it back. Fails with `not_found` (`component_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsDelete(string $projectId, string $componentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsDelete($projectId, $componentId), $fetch);
    }
    /**
     * Reads one component. Fails with `not_found` (`component_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsGet(string $projectId, string $componentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsGet($projectId, $componentId), $fetch);
    }
    /**
     * Renames a component or moves it to another editor group; `category: null` moves it back to the project's default group. Fails with `invalid_request` (`invalid_component`) for a title outside 1 to 255 characters or a category over 64. Fails with `not_found` (`component_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallComponentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsUpdate(string $projectId, string $componentId, \Voidhash\Generated\Core\Model\UpdatePaywallComponentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsUpdate($projectId, $componentId, $requestBody), $fetch);
    }
    /**
     * Lists a component's versions, newest first, or the one with a `version` number. Fails with `not_found` (`component_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "version"?: int, //Only the version with this number, counted from 1.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListVersionsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListVersionsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListVersionsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListVersionsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListVersionsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentsComponentIdVersionsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsListVersions(string $projectId, string $componentId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsListVersions($projectId, $componentId, $queryParameters), $fetch);
    }
    /**
     * Reads one version with its build status, build log and, for Rust sources, its crate files. Versions stay readable after their component is deleted, since published paywalls may still embed them. Fails with `not_found` (`component_version_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param string $versionId The id of the component's version, `cmp_ver_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsGetVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsGetVersion(string $projectId, string $componentId, string $versionId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsGetVersion($projectId, $componentId, $versionId), $fetch);
    }
    /**
     * Deprecates a version (`isDeprecated: true`) or lifts its deprecation. A deprecated version cannot be newly inserted or published; placed instances keep rendering and published paywalls keep working. Fails with `not_found` (`component_version_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $componentId The component's id, `cmp_...`.
     * @param string $versionId The id of the component's version, `cmp_ver_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallComponentVersionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsUpdateVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsUpdateVersion(string $projectId, string $componentId, string $versionId, \Voidhash\Generated\Core\Model\UpdatePaywallComponentVersionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsUpdateVersion($projectId, $componentId, $versionId, $requestBody), $fetch);
    }
    /**
     * Lists the component versions the project's published paywalls embed, project and registry components alike, with how many published paywalls embed each, so deprecated, deleted or yanked components can be found where they are still live.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListUsesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListUsesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListUsesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListUsesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsListUsesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentUsesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function componentsListUses(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ComponentsListUses($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads whether debug builds can buy through the sandbox.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SandboxSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sandboxGetSettings(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SandboxGetSettings($projectId), $fetch);
    }
    /**
     * Turns sandbox purchasing on or off. Sandbox purchases already made stay.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpdateSandboxSettingsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SandboxUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SandboxUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SandboxUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SandboxUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SandboxUpdateSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SandboxSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sandboxUpdateSettings(string $projectId, \Voidhash\Generated\Core\Model\UpdateSandboxSettingsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SandboxUpdateSettings($projectId, $requestBody), $fetch);
    }
    /**
     * Reads one person's sandbox purchases, subscriptions and the access they grant, including those of persons merged into them. Fails with `not_found` (`person_not_found`) for a person the project does not have.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "personId": string, //The person whose sandbox purchases to read.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetStateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetStateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetStateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetStateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SandboxGetStateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SandboxStateJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sandboxGetState(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SandboxGetState($projectId, $queryParameters), $fetch);
    }
    /**
     * Simulates a store event on a sandbox purchase or subscription: a purchase can be `refund`ed or `revoke`d; a subscription can `expire`, be `revoke`d, `renew` or enter a three-day `grace_period`. The person's access changes at once; webhooks and analytics follow in the background. Repeating an `actionId` applies the action once. Fails with `invalid_request` (`action_not_allowed`) for an action the target does not support, and `not_found` (`sandbox_target_not_found`) for a target that is not a sandbox purchase or subscription of the project.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateSandboxActionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SandboxCreateActionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SandboxCreateActionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SandboxCreateActionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SandboxCreateActionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SandboxCreateActionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SandboxActionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sandboxCreateAction(string $projectId, \Voidhash\Generated\Core\Model\CreateSandboxActionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SandboxCreateAction($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes every sandbox purchase, subscription and the access they granted in the project. Production and store sandbox purchases are untouched.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SandboxDeleteDataBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SandboxDeleteDataUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SandboxDeleteDataForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SandboxDeleteDataNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SandboxDeleteDataInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function sandboxDeleteData(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SandboxDeleteData($projectId), $fetch);
    }
    /**
     * Lists the project's stored events, most recently stored first, optionally only those with a `name`. An event sent late, such as by a device that was offline, is listed from when it was stored, so reading from the first page again finds it; an event delivered again with the same `id` is listed once, at its latest delivery. Events the ingest policy refused are not stored. A secret key lists its own environment's events; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `invalid_request` (`invalid_cursor`) for a malformed cursor.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "name"?: string, //Only events with this exact name.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\EventsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\EventsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\EventsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\EventsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\EventsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdEventsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function eventsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\EventsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Lists the project's experiments in use, or the archived ones with `isArchived=true`, optionally only those with a `status`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "status"?: string, //Only experiments with this status: `draft`, `running`, `paused` or `concluded`.
     *    "isArchived"?: string, //`true` for only archived experiments; otherwise, the default, only the ones not archived.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a draft experiment with a control and one other arm at 50% each, and the feature flag that will assign end users to them. Set its arms with `PUT .../variants` and its goal (`primaryMetricEventName`) with `PATCH` before starting it: the default goal, `purchase_completed`, is an event Voidhash never sends, so an experiment left on it records no conversions.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Reads one experiment, archived or not. Fails with `not_found` (`experiment_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsGet(string $projectId, string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsGet($projectId, $experimentId), $fetch);
    }
    /**
     * Renames an experiment or changes its description, hypothesis or metrics. Set `primaryMetricEventName` explicitly, such as to `$subscription.created` or `$purchase.completed`: the default, `purchase_completed`, is never sent by Voidhash. Fails with `conflict` (`experiment_metrics_locked`) when changing a metric after it left `draft`; sending the metrics it already has is fine.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsUpdate(string $projectId, string $experimentId, \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsUpdate($projectId, $experimentId, $requestBody), $fetch);
    }
    /**
     * Archives a draft or concluded experiment; its status stays as it was. Fails with `conflict` (`experiment_in_progress`) while it runs or is paused, because its paywall locations would then show nothing; conclude it first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsArchive(string $projectId, string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsArchive($projectId, $experimentId), $fetch);
    }
    /**
     * Brings an archived experiment back with the status it had.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUnarchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsUnarchive(string $projectId, string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsUnarchive($projectId, $experimentId), $fetch);
    }
    /**
     * Starts a draft experiment, or resumes a paused one: each of its paywall locations starts splitting end users between the arms, and each feature flag it sets takes the value of the end user's arm. Fails with `conflict` (`experiment_already_running`, `experiment_concluded` or `experiment_archived`) when the experiment is running, concluded or archived, and `conflict` (`experiment_not_startable`) when a placed paywall has no deployed build, a location runs another experiment, or another running or paused experiment sets one of its flags.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsStart(string $projectId, string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsStart($projectId, $experimentId), $fetch);
    }
    /**
     * Pauses a running experiment: every end user sees the control arm, and gets its flag values, until it is started again. Fails with `conflict` (`experiment_not_running`) unless it is running.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsPause(string $projectId, string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsPause($projectId, $experimentId), $fetch);
    }
    /**
     * Ends an experiment for good: the winning arm, or the control without one, becomes the paywall shown at each of its locations, and each feature flag it set goes on giving that arm's value to everyone the flag's own rules and overrides do not name. Fails with `conflict` (`experiment_not_started`) for a draft, `conflict` (`experiment_concluded`) when already concluded, and `invalid_request` (`experiment_variant_not_found`) when the winner is not one of its arms.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsConclude(string $projectId, string $experimentId, \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsConclude($projectId, $experimentId, $requestBody), $fetch);
    }
    /**
     * Lists the experiment's arms with their weights, the paywall each shows at each location and the value each gives the feature flags the experiment sets.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListVariantsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListVariantsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsListVariants(string $projectId, string $experimentId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsListVariants($projectId, $experimentId, $queryParameters), $fetch);
    }
    /**
     * Replaces the experiment's arms, placements and flag values with the ones given and answers all of them. Name an existing arm's `id` to keep it, so end users in it stay there. Exactly one arm is the control and the weights total 100. An arm may show paywalls, give feature flags a value (`flagValues`), or both; a flag one arm gives a value, every arm must, and it has to be one of the project's own flags, not archived. Fails with `invalid_request` (`invalid_variants`, `experiment_variant_not_found`, `paywall_not_found`, `paywall_location_not_found`) and with `conflict` (`experiment_variants_locked`) while it runs; pause it first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsPutResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsReplaceVariants(string $projectId, string $experimentId, \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsReplaceVariants($projectId, $experimentId, $requestBody), $fetch);
    }
    /**
     * Reports each arm's exposures, conversions and revenue since the experiment last started, until it concluded. A secret key counts its own environment; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `unavailable` (`experiment_results_too_large`) when it has more events than this deployment can count at once.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetResultsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetResultsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetResultsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetResultsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetResultsInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetResultsServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentResultsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsGetResults(string $projectId, string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsGetResults($projectId, $experimentId), $fetch);
    }
    /**
     * Lists the project's flags in use, or the archived ones with `isArchived=true`, optionally only the one with a `key`. Flags owned by experiments are not listed.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "key"?: string, //Only the flag with this key; the page then holds at most one.
     *    "isArchived"?: string, //`true` for only archived flags; otherwise, the default, only the ones not archived.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a flag, switched off and serving nobody in production, with test following production. A `string`, `number` or `json` flag takes `variants` whose values match its type; a `boolean` flag has none. Fails with `invalid_request` (`invalid_variants`) when they do not fit, and with `conflict` (`feature_flag_key_taken`) when another flag, archived or not, uses the key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Evaluates the project's flags in use for one end user, as their app would in an `environment`, and says why each came out as it did. Name the end user by any of `personId`, `distinctId`, `email` or `externalIds`. Fails with `invalid_request` (`identity_required`) without one. Safe to repeat. It changes no flag; as an app's read does, it places the end user in an arm of a running experiment that sets one of the flags, when they are named by `personId` or `distinctId` and are in none yet. Send `isPreview: true` to look at an end user without placing them.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagEvaluationsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsEvaluate(string $projectId, \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsEvaluate($projectId, $requestBody), $fetch);
    }
    /**
     * Reads one flag, archived or not, including an experiment's flag. Fails with `not_found` (`feature_flag_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsGet(string $projectId, string $featureFlagId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsGet($projectId, $featureFlagId), $fetch);
    }
    /**
     * Changes a flag's key or description. Who gets the flag is set per environment. Fails with `conflict` (`feature_flag_key_taken`) when another flag uses the key, and `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsUpdate(string $projectId, string $featureFlagId, \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsUpdate($projectId, $featureFlagId, $requestBody), $fetch);
    }
    /**
     * Archives a flag: apps stop receiving it and it leaves the flag list, keeping its key. Archiving an archived flag changes nothing. Fails with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsArchive(string $projectId, string $featureFlagId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsArchive($projectId, $featureFlagId), $fetch);
    }
    /**
     * Brings an archived flag back as it was. Fails with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUnarchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUnarchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsUnarchive(string $projectId, string $featureFlagId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsUnarchive($projectId, $featureFlagId), $fetch);
    }
    /**
     * Lists the values the flag can evaluate to and the share of traffic each gets.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListVariantsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListVariantsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsListVariants(string $projectId, string $featureFlagId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsListVariants($projectId, $featureFlagId, $queryParameters), $fetch);
    }
    /**
     * Replaces the flag's variants with the ones given and answers all of them. Name an existing variant's `id` to keep it, so end users in it stay there; variants left out are removed, and traffic splits evenly. Fails with `invalid_request` (`invalid_variants`) when values do not match the flag's type, an `id` is not one of its variants, or an environment still serves or overrides a variant being removed, and with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag; set an experiment's arms through the experiment.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceVariantsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceVariantsConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceVariantsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsPutResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsReplaceVariants(string $projectId, string $featureFlagId, \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsReplaceVariants($projectId, $featureFlagId, $requestBody), $fetch);
    }
    /**
     * Removes test's own configuration, so test follows production again. Removing it when test has none changes nothing. Fails with `invalid_request` (`production_environment_required`) for `production`, which a flag always has, and with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $environment The environment whose configuration is meant: `production`, or `test`, which a test key reads.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsClearEnvironmentBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsClearEnvironmentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsClearEnvironmentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsClearEnvironmentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsClearEnvironmentConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsClearEnvironmentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsClearEnvironment(string $projectId, string $featureFlagId, string $environment, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsClearEnvironment($projectId, $featureFlagId, $environment), $fetch);
    }
    /**
     * Replaces who gets the flag in one environment: its switch, overrides, rules and fallthrough, read in that order. Setting `test` gives test a configuration of its own; until then it follows production. Fails with `invalid_request` (`invalid_environment`) when a variant named is not one of the flag's, or an end user or rule id is listed twice, and with `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $environment The environment whose configuration is meant: `production`, or `test`, which a test key reads.
     * @param \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsSetEnvironmentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsSetEnvironment(string $projectId, string $featureFlagId, string $environment, \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsSetEnvironment($projectId, $featureFlagId, $environment, $requestBody), $fetch);
    }
    /**
     * Lists the end users the flag is fixed on or off for in an `environment`, whatever its rules say. Test's are production's while test follows it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "environment"?: string, //The environment whose overrides are meant: `production`, the default, or `test`. Setting or removing one in `test` gives test a configuration of its own, started from production's.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdOverridesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsListOverrides(string $projectId, string $featureFlagId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsListOverrides($projectId, $featureFlagId, $queryParameters), $fetch);
    }
    /**
     * Removes one end user's override in an `environment`, so the flag evaluates for them as for anyone. Fails with `not_found` (`feature_flag_override_not_found`) when there is none.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $identity The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`.
     * @param array{
     *    "environment"?: string, //The environment whose overrides are meant: `production`, the default, or `test`. Setting or removing one in `test` gives test a configuration of its own, started from production's.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRemoveOverrideBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRemoveOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRemoveOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRemoveOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRemoveOverrideConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRemoveOverrideInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsRemoveOverride(string $projectId, string $featureFlagId, string $identity, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsRemoveOverride($projectId, $featureFlagId, $identity, $queryParameters), $fetch);
    }
    /**
     * Fixes the flag on or off for one end user, `{identityType}:{identityValue}` in the path, in an `environment`, optionally in one variant by its `variantKey`, whatever the rules say. Replaces the end user's override there, answering 201 when there was none. In `test` it gives test a configuration of its own, started from production's. Works on an experiment's flag in `production`, to put a tester in an arm. Fails with `invalid_request` (`unknown_variant`) when the flag has no such variant, `invalid_request` (`variant_requires_enabled`) for a variant with `isEnabled: false`, and `conflict` (`feature_flag_managed_by_experiment`) for an experiment's flag in `test`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $featureFlagId The flag's id, `ff_...`.
     * @param string $identity The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`.
     * @param \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment whose overrides are meant: `production`, the default, or `test`. Setting or removing one in `test` gives test a configuration of its own, started from production's.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpsertOverrideInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsUpsertOverride(string $projectId, string $featureFlagId, string $identity, \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding $requestBody, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsUpsertOverride($projectId, $featureFlagId, $identity, $requestBody, $queryParameters), $fetch);
    }
    /**
     * Lists one end user's overrides across the project's flags in use and both environments; name them by `identity`, `{identityType}:{identityValue}`. Test's are listed for flags whose test has a configuration of its own.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "identity": string, //The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesByIdentityBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesByIdentityUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesByIdentityForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesByIdentityNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListOverridesByIdentityInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagOverridesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsListOverridesByIdentity(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsListOverridesByIdentity($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads which events the project stores: every built-in (`$`-prefixed) event setting with its default, and the custom events it blocks. Built-in events are stored only once enabled; custom events are stored unless blocked.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\IngestPolicyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function ingestPolicyGet(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\IngestPolicyGet($projectId), $fetch);
    }
    /**
     * Turns storing a built-in event on or off. Fails with `not_found` (`builtin_event_not_found`) for a `key` that names no built-in event setting.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $key The built-in event setting's key: a built-in event's name, such as `$screen`, or `revenue` for the revenue events.
     * @param \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function ingestPolicyUpsertBuiltinEvent(string $projectId, string $key, \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\IngestPolicyUpsertBuiltinEvent($projectId, $key, $requestBody), $fetch);
    }
    /**
     * Blocks or unblocks storing a custom event, named URL-encoded in the path. Fails with `invalid_request` (`reserved_event_name`) for a blank or `$`-prefixed name; built-in events are turned on and off by their setting instead.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $eventName The custom event's name, URL-encoded. Surrounding spaces are trimmed.
     * @param \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\CustomEventSettingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function ingestPolicyUpsertCustomEvent(string $projectId, string $eventName, \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\IngestPolicyUpsertCustomEvent($projectId, $eventName, $requestBody), $fetch);
    }
    /**
     * Lists the project's push notifications, newest first, with how many deliveries succeeded, failed or were skipped.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Sends a push notification to the devices of the persons named by `personIds` and `distinctIds`, and answers 202 while the deliveries continue in the background; follow them with `GET .../push-notifications/{pushNotificationId}/deliveries`. Distinct ids that name no person are reported in `unresolvedDistinctIds`, not refused. Fails with `invalid_request` (`recipients_required`) without at least one person. Devices of a push service the project has not enabled are skipped. Fails with `conflict` (`push_notifications_not_configured`) when the project has no enabled push service. Repeating a send with the same `Idempotency-Key` header returns the first one instead of sending again. Fails with `permission_denied` (`push_notifications_not_enabled`) when push notifications are not enabled for the organization.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePushNotificationBodyJsonEncoding $requestBody
     * @param array{
     *    "idempotency-key"?: string, //Repeating a send with the same key returns the first send instead of sending again.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AcceptedPushNotificationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePushNotificationBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationsCreate($projectId, $requestBody, $headerParameters), $fetch);
    }
    /**
     * Lists the deliveries of a push notification, one per device, oldest first, optionally only those with one `status` (such as `failed`). Fails with `not_found` (`push_notification_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $pushNotificationId The push notification's id, `push_send_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "status"?: string, //Only deliveries in this state, such as `failed` or `exhausted`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListDeliveriesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListDeliveriesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListDeliveriesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListDeliveriesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationsListDeliveriesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationsPushNotificationIdDeliveriesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationsListDeliveries(string $projectId, string $pushNotificationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationsListDeliveries($projectId, $pushNotificationId, $queryParameters), $fetch);
    }
    /**
     * Lists the organizations the person belongs to, or the one with a `slug`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "slug"?: string, //Only the organization with this slug, if the person belongs to it; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsList(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsList($queryParameters), $fetch);
    }
    /**
     * Creates an organization with the person as its owner. Its slug is chosen from the name. An app limited to reading cannot create one.
     * @param \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsCreate(\Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsCreate($requestBody), $fetch);
    }
    /**
     * Permanently deletes an organization with its projects and everything in them. Needs permission to delete the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsDelete(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsDelete($organizationId), $fetch);
    }
    /**
     * Reads one organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsGet(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsGet($organizationId), $fetch);
    }
    /**
     * Renames an organization. Its slug never changes. Needs permission to update the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsUpdate(string $organizationId, \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsUpdate($organizationId, $requestBody), $fetch);
    }
    /**
     * Reads the organization's settings: the currency its insights and ad reports give money in, and the language its bots write in.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsGetSettings(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsGetSettings($organizationId), $fetch);
    }
    /**
     * Changes the settings in the body; settings left out keep their values. Returns every setting. A reporting currency applies to every report from then on, past ranges included. Fails with `invalid_request` (`unsupported_currency`) for a currency without exchange rates back to 2010. A preferred language applies to a bot's next message. Fails with `invalid_request` (`unsupported_language`) for a language Voidhash doesn't offer. Nothing changes when a setting fails. Needs permission to update the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsUpdateSettings(string $organizationId, \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsUpdateSettings($organizationId, $requestBody), $fetch);
    }
    /**
     * Removes the organization's logo. Needs permission to update the organization. Fails with `unavailable` (`file_storage_unavailable`) when file storage cannot be reached.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsRemoveAvatarBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsRemoveAvatarUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsRemoveAvatarForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsRemoveAvatarNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsRemoveAvatarInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsRemoveAvatarServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsRemoveAvatar(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsRemoveAvatar($organizationId), $fetch);
    }
    /**
     * Replaces the organization's logo with the image in the body and returns the organization. Fails with `invalid_request` (`invalid_image`) for an image of the wrong type or size, `conflict` (`avatar_busy`) while an earlier upload is still being processed, and `unavailable` (`file_storage_unavailable`) when file storage cannot be reached.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarConflictException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsSetAvatarServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsSetAvatar(string $organizationId, \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsSetAvatar($organizationId, $requestBody), $fetch);
    }
    /**
     * Lists the project's payment providers, optionally only one `type`. Stored credentials read as `<stored secret>`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "type"?: string, //Only providers of this type: `app_store`, `google_play`, `stripe` or `payment_source`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersList($projectId, $queryParameters), $fetch);
    }
    /**
     * Adds a payment provider. A store starts disabled; save its settings and credentials with an update that enables it. A payment source is created with `configuration: { slug }`, which it keeps, and is enabled at once. A project has one provider per store and one payment source per slug. Fails with `conflict` (`payment_provider_exists`) for another. Fails with `invalid_request` (`invalid_payment_provider_configuration`) for invalid settings.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePaymentProviderBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a payment provider; purchases it recorded keep their history. Fails with `conflict` (`payment_provider_in_use`) while store products are mapped to products: delete those mappings first. Fails with `not_found` (`payment_provider_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersDeleteConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersDelete(string $projectId, string $paymentProviderId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersDelete($projectId, $paymentProviderId), $fetch);
    }
    /**
     * Reads one payment provider. Stored credentials read as `<stored secret>`. Fails with `not_found` (`payment_provider_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersGet(string $projectId, string $paymentProviderId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersGet($projectId, $paymentProviderId), $fetch);
    }
    /**
     * Renames, enables or disables a payment provider, or replaces its `configuration`. A credential sent as `<stored secret>` keeps the stored one. Enabling validates the settings and credentials with the store, while a disabled provider saves incomplete settings. Fails with `invalid_request` (`invalid_payment_provider_configuration`) when enabling a provider whose settings or credentials the store refuses. A payment source keeps its slug. Fails with `conflict` (`payment_provider_key_taken`) when another provider of the project is set up for the same app or account. The last update wins.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePaymentProviderBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersUpdate(string $projectId, string $paymentProviderId, \Voidhash\Generated\Core\Model\UpdatePaymentProviderBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersUpdate($projectId, $paymentProviderId, $requestBody), $fetch);
    }
    /**
     * Sends a signed `describe` request to a payment source's endpoint and returns the operations it implements. Changes nothing. `environment=test` sends a test request to the endpoint test requests go to: the `testEndpoint`, or the `endpoint` of a source without one. By default a production request tests the `endpoint`; production requests never go to the `testEndpoint`. Only a payment source can be tested. Fails with `invalid_request` (`payment_source_required`) for a store. Fails with `conflict` (`payment_source_endpoint_not_configured`) for a source without an endpoint for the environment, `conflict` (`payment_source_endpoint_rejected`) when the endpoint refuses the request, and `unavailable` (`payment_source_endpoint_unavailable` or `payment_source_endpoint_invalid_response`) when it does not answer or answers outside the protocol. The message says what to fix.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param array{
     *    "environment"?: string, //Which endpoint to test: `production`, the default, tests `endpoint`; `test` tests `testEndpoint`, or `endpoint` when there is none.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentSourceEndpointDescription : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersTest(string $projectId, string $paymentProviderId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersTest($projectId, $paymentProviderId, $queryParameters), $fetch);
    }
    /**
     * Lists the products the provider sells, read from the store or a payment source's endpoint, with the mappings of each to products. Store products already mapped stay listed after the store removed them. The store's answer is cached until the provider changes; `refresh=true` reads it again. `isUnmapped=true` keeps only the store products without a mapping, `isUnmapped=false` only those with one; map one with `POST .../payment-providers/{paymentProviderId}/products`. Fails with `not_found` (`payment_provider_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "isUnmapped"?: string, //`true` keeps only the store products no product is mapped to, `false` only those with a mapping.
     *    "refresh"?: string, //`true` reads the catalog from the store again instead of the copy cached until the provider changes.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListCatalogBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListCatalogUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListCatalogForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListCatalogNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListCatalogInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdCatalogGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersListCatalog(string $projectId, string $paymentProviderId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersListCatalog($projectId, $paymentProviderId, $queryParameters), $fetch);
    }
    /**
     * Lists up to 50 store products whose imported purchase events wait for a mapping, most waiting events first. Mapping one to a product applies its events. Fails with `not_found` (`payment_provider_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListUnmappedProductsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListUnmappedProductsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListUnmappedProductsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListUnmappedProductsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersListUnmappedProductsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdUnmappedProductsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProvidersListUnmappedProducts(string $projectId, string $paymentProviderId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProvidersListUnmappedProducts($projectId, $paymentProviderId, $queryParameters), $fetch);
    }
    /**
     * Lists the provider's store product mappings, optionally only those of one `productId` or `providerProductKey`, or only active ones. Fails with `not_found` (`payment_provider_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "productId"?: string, //Only the mappings to this product.
     *    "providerProductKey"?: string, //Only the mappings of the store product with this key.
     *    "isActive"?: string, //`true` keeps only active mappings, `false` only inactive ones.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdProductsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsList(string $projectId, string $paymentProviderId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsList($projectId, $paymentProviderId, $queryParameters), $fetch);
    }
    /**
     * Maps a store product, named by `configuration` as the provider's catalog entry shows, to a product. The mapping is active at once, and purchases of the store product, including ones that waited for a mapping, grant the product's perks. A product can sell several store products. A store product active for another product needs `isReassignment: true`, which moves it to this product and deactivates the other mapping; reassigning a store product already mapped to this product updates that mapping. Fails with `invalid_request` (`invalid_product_mapping`) for a store product active for another product without `isReassignment`. Fails with `not_found` (`payment_provider_not_found`, `product_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsCreate(string $projectId, string $paymentProviderId, \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsCreate($projectId, $paymentProviderId, $requestBody), $fetch);
    }
    /**
     * Deletes a mapping; purchases of the store product fall back to an earlier mapping of it, if any. Fails with `conflict` (`product_mapping_has_purchases`) for a mapping purchases were recorded under, which cannot be deleted. Fails with `not_found` (`product_mapping_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $mappingId The mapping's id, `pp_prod_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeleteConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsDelete(string $projectId, string $paymentProviderId, string $mappingId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsDelete($projectId, $paymentProviderId, $mappingId), $fetch);
    }
    /**
     * Reads one store product mapping. Fails with `not_found` (`payment_provider_not_found`, `product_mapping_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $mappingId The mapping's id, `pp_prod_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsGet(string $projectId, string $paymentProviderId, string $mappingId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsGet($projectId, $paymentProviderId, $mappingId), $fetch);
    }
    /**
     * Replaces a mapping's `configuration`, such as its offers. Fails with `invalid_request` (`invalid_product_mapping`) when changing the store product of a mapping with purchases, or taking over a store product active for another product. The last update wins.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $mappingId The mapping's id, `pp_prod_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductMappingBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsUpdate(string $projectId, string $paymentProviderId, string $mappingId, \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductMappingBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsUpdate($projectId, $paymentProviderId, $mappingId, $requestBody), $fetch);
    }
    /**
     * Activates a mapping, so purchases of its store product grant its product's perks again; the product's other mappings stay active. Fails with `conflict` (`store_product_already_mapped`) while the store product is active for another product: create the mapping with `isReassignment` to move it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $mappingId The mapping's id, `pp_prod_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsActivate(string $projectId, string $paymentProviderId, string $mappingId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsActivate($projectId, $paymentProviderId, $mappingId), $fetch);
    }
    /**
     * Records a charge or refund the payment source took, under the source's own id for it. Idempotent on `externalId`: the same request again returns the recorded transaction; correct a payment with a refund. Fails with `conflict` (`transaction_conflict`) for a different request with the same `externalId`. Fails with `invalid_request` (`invalid_transaction`) for a transaction that cannot be recorded as sent, which records nothing. Only a payment source records purchases. Fails with `not_found` (`payment_provider_not_found`) for an unknown provider, `invalid_request` (`payment_source_required`) for a store, and `conflict` (`payment_source_disabled`) for a disabled source.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $externalId The payment source's own id for the transaction or subscription; to request a refund, the charge's.
     * @param \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertTransactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertTransactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertTransactionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertTransactionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertTransactionConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertTransactionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentSourceTransaction : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentSourcesUpsertTransaction(string $projectId, string $paymentProviderId, string $externalId, \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentSourcesUpsertTransaction($projectId, $paymentProviderId, $externalId, $requestBody), $fetch);
    }
    /**
     * Asks the source's endpoint to refund a recorded charge, for `amount` or all that is left of it, then records the refund it answers with and returns it, under the source's id for the refund. Fails with `not_found` (`transaction_not_found`) when the charge is not recorded, and with `invalid_request` (`invalid_transaction`) when the refund answered cannot be recorded, which records nothing. Only a payment source records purchases. Fails with `not_found` (`payment_provider_not_found`) for an unknown provider, `invalid_request` (`payment_source_required`) for a store, and `conflict` (`payment_source_disabled`) for a disabled source. Fails with `conflict` (`payment_source_endpoint_not_configured`, `payment_source_endpoint_unsupported` or `payment_source_endpoint_rejected`) when the source's endpoint is not configured, does not support the action or refuses it, and `unavailable` (`payment_source_endpoint_unavailable` or `payment_source_endpoint_invalid_response`) when it does not answer or answers outside the protocol; the message says why.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $externalId The payment source's own id for the transaction or subscription; to request a refund, the charge's.
     * @param \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentSourceTransaction : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentSourcesRefundTransaction(string $projectId, string $paymentProviderId, string $externalId, \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentSourcesRefundTransaction($projectId, $paymentProviderId, $externalId, $requestBody), $fetch);
    }
    /**
     * Records the latest state of a subscription the payment source manages, under the source's own id for it. Idempotent on `externalId` and ordered by `updatedAt`: a state older than the recorded one is `superseded` and changes nothing. Fails with `invalid_request` (`invalid_subscription`) for a state that cannot be recorded as sent. Only a payment source records purchases. Fails with `not_found` (`payment_provider_not_found`) for an unknown provider, `invalid_request` (`payment_source_required`) for a store, and `conflict` (`payment_source_disabled`) for a disabled source.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $externalId The payment source's own id for the transaction or subscription; to request a refund, the charge's.
     * @param \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentSourceSubscription : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentSourcesUpsertSubscription(string $projectId, string $paymentProviderId, string $externalId, \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentSourcesUpsertSubscription($projectId, $paymentProviderId, $externalId, $requestBody), $fetch);
    }
    /**
     * Asks the source's endpoint to cancel a subscription, at the end of the paid period unless `isImmediate` is `true`, then records the state it answers with like a reported one. Fails with `invalid_request` (`invalid_subscription`) for a state that cannot be recorded. Only a payment source records purchases. Fails with `not_found` (`payment_provider_not_found`) for an unknown provider, `invalid_request` (`payment_source_required`) for a store, and `conflict` (`payment_source_disabled`) for a disabled source. Fails with `conflict` (`payment_source_endpoint_not_configured`, `payment_source_endpoint_unsupported` or `payment_source_endpoint_rejected`) when the source's endpoint is not configured, does not support the action or refuses it, and `unavailable` (`payment_source_endpoint_unavailable` or `payment_source_endpoint_invalid_response`) when it does not answer or answers outside the protocol; the message says why.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $externalId The payment source's own id for the transaction or subscription; to request a refund, the charge's.
     * @param \Voidhash\Generated\Core\Model\CancelPaymentSourceSubscriptionBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesCancelSubscriptionServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentSourceSubscription : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentSourcesCancelSubscription(string $projectId, string $paymentProviderId, string $externalId, \Voidhash\Generated\Core\Model\CancelPaymentSourceSubscriptionBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentSourcesCancelSubscription($projectId, $paymentProviderId, $externalId, $requestBody), $fetch);
    }
    /**
     * Lists the project's paywall locations, newest first, with what each shows now, and what it shows apps using a test key when that differs: all of them, only archived ones (`isArchived=true`) or only the others (`isArchived=false`), or the one with a `slug`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "isArchived"?: string, //`true` for only archived locations, `false` for only the others; omitted, both are listed.
     *    "slug"?: string, //Only the location with this slug; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a location showing nothing. Apps ask for it by its slug, which cannot change afterwards. Fails with `conflict` (`paywall_location_slug_taken`) when the slug is in use.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Reads one location, archived or not, with what it shows now, and what it shows apps using a test key when that differs. Fails with `not_found` (`paywall_location_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsGet(string $projectId, string $paywallLocationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsGet($projectId, $paywallLocationId), $fetch);
    }
    /**
     * Changes a location's name or description; `description: null` clears it. The slug cannot change, because apps ask for the location by it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsUpdate(string $projectId, string $paywallLocationId, \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsUpdate($projectId, $paywallLocationId, $requestBody), $fetch);
    }
    /**
     * Archives a location and ends what it shows in both environments, so apps asking for it get no paywall. Archiving an archived location changes nothing.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsArchive(string $projectId, string $paywallLocationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsArchive($projectId, $paywallLocationId), $fetch);
    }
    /**
     * Ends the location's placement, so apps asking for it get no paywall. With `environment=test` it ends test's own showing instead, so apps using a test key get what production shows again. Clearing an environment that has no showing changes nothing.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param array{
     *    "environment"?: string, //The environment whose showing is meant: `production`, the default, or `test`, which only apps using a test key see. Test follows production until it is given a showing of its own, and clearing test's goes back to following production.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearShowingBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearShowingUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearShowingForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearShowingNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearShowingInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsClearShowing(string $projectId, string $paywallLocationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsClearShowing($projectId, $paywallLocationId, $queryParameters), $fetch);
    }
    /**
     * Places a paywall at the location: from now on, end users see its deployed build there. This ends the location's previous placement, even when that was a running experiment. With `environment=test` only apps using a test key see it, and production keeps what it shows; until a location has a test showing, test keys get production's. Placing the paywall the environment already shows changes nothing. Fails with `not_found` (`paywall_not_found`) when the project has no such paywall, and with `conflict` (`paywall_not_deployed`) when the paywall has no deployed build, or `conflict` (`paywall_location_archived`) when the location is archived.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment whose showing is meant: `production`, the default, or `test`, which only apps using a test key see. Test follows production until it is given a showing of its own, and clearing test's goes back to following production.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsSetShowing(string $projectId, string $paywallLocationId, \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsSetShowing($projectId, $paywallLocationId, $requestBody, $queryParameters), $fetch);
    }
    /**
     * Lists what the location has shown in either environment, most recently started first: one entry for each paywall build or experiment it showed, where and when. An environment's current one, if any, has a null `endedAt`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListShowingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListShowingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListShowingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListShowingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListShowingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdShowingsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsListShowings(string $projectId, string $paywallLocationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsListShowings($projectId, $paywallLocationId, $queryParameters), $fetch);
    }
    /**
     * Lists the end users pinned to a paywall at the location, newest first: each is shown their pin's paywall whatever the location shows everyone else. Both environments unless `environment` names one.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "environment"?: string, //Only the pins of one environment: `production` or `test`. Omitted, both are listed.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPinsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPinsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPinsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPinsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPinsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdPinsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsListPins(string $projectId, string $paywallLocationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsListPins($projectId, $paywallLocationId, $queryParameters), $fetch);
    }
    /**
     * Removes one end user's pin in an `environment`, so they see what the location shows everyone else again. Fails with `not_found` (`paywall_location_pin_not_found`) when there is none.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param string $identity The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`. The type is `person_id`, `distinct_id` or `email`.
     * @param array{
     *    "environment"?: string, //The environment the pin is for: `production`, the default, which answers every app, or `test`, which answers apps using a test key only and wins there.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsRemovePinBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsRemovePinUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsRemovePinForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsRemovePinNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsRemovePinInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsRemovePin(string $projectId, string $paywallLocationId, string $identity, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsRemovePin($projectId, $paywallLocationId, $identity, $queryParameters), $fetch);
    }
    /**
     * Pins one end user, `{identityType}:{identityValue}` in the path, to a paywall at the location: they see its deployed build there whatever the location shows everyone else, and are outside an A/B test running there. Replaces the end user's pin in that `environment`, answering 201 when there was none. A `production` pin answers every app; a `test` pin answers apps using a test key only and wins there. A pin shows only where the location shows something in that environment. Fails with `invalid_request` (`invalid_identity`) for an identity that is blank or longer than 255 characters, `not_found` (`paywall_not_found`) when the project has no such paywall, and `conflict` (`paywall_not_deployed`) when the paywall has no deployed build, `conflict` (`paywall_location_archived`) when the location is archived, or `conflict` (`paywall_location_pin_limit`) when the location already holds 200 pins.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param string $identity The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`. The type is `person_id`, `distinct_id` or `email`.
     * @param \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment the pin is for: `production`, the default, which answers every app, or `test`, which answers apps using a test key only and wins there.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationPinJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsUpsertPin(string $projectId, string $paywallLocationId, string $identity, \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding $requestBody, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsUpsertPin($projectId, $paywallLocationId, $identity, $requestBody, $queryParameters), $fetch);
    }
    /**
     * Lists the location's rules in the order they are read: each shows the end users all its conditions hold for another paywall than the location shows everyone else. Both environments unless `environment` names one.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "environment"?: string, //Only the rules of one environment: `production` or `test`. Omitted, both are listed, production's first.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdRulesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsListRules(string $projectId, string $paywallLocationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsListRules($projectId, $paywallLocationId, $queryParameters), $fetch);
    }
    /**
     * Replaces the rules of the location in one `environment`, in the order given; an empty list removes them. The first rule whose conditions all hold for an end user and their app shows them its paywall's deployed build, in place of what the location shows everyone else, and keeps them out of an A/B test running there. Conditions are those of a feature flag's rule. Pins are read before rules. A `production` rule answers every app; a `test` rule answers apps using a test key only and is read first there. A rule shows only where the location shows something in that environment. Fails with `invalid_request` (`invalid_rules`) for a rule without conditions or with one that can't be read, `not_found` (`paywall_not_found`) when the project has no such paywall, and `conflict` (`paywall_not_deployed`) when a paywall has no deployed build or `conflict` (`paywall_location_archived`) when the location is archived.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment whose rules are replaced: `production`, the default, whose rules answer every app, or `test`, whose rules answer apps using a test key only and are read first there.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationRulesJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsReplaceRules(string $projectId, string $paywallLocationId, \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding $requestBody, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsReplaceRules($projectId, $paywallLocationId, $requestBody, $queryParameters), $fetch);
    }
    /**
     * Lists the project's paywalls, newest first: all of them, only archived ones (`isArchived=true`) or only the others (`isArchived=false`), or the one with a `slug`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "isArchived"?: string, //`true` for only archived paywalls, `false` for only the others; omitted, both are listed.
     *    "slug"?: string, //Only the paywall with this slug; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates an empty paywall, or an onboarding flow with `kind: onboarding`. The slug cannot change afterwards. Fails with `conflict` (`paywall_slug_taken`) when the slug is in use.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a paywall for good, archived or not. This cannot be undone, and a location showing the paywall shows nothing afterwards; archive it to keep it instead.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsDelete(string $projectId, string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsDelete($projectId, $paywallId), $fetch);
    }
    /**
     * Reads one paywall, archived or not. Fails with `not_found` (`paywall_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsGet(string $projectId, string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsGet($projectId, $paywallId), $fetch);
    }
    /**
     * Renames a paywall. Its slug and kind cannot change, and its design is edited in the studio or with the MCP paywall tools.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsUpdate(string $projectId, string $paywallId, \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsUpdate($projectId, $paywallId, $requestBody), $fetch);
    }
    /**
     * Archives a paywall. Locations showing it keep showing its deployed build, and `unarchive` restores it. Archiving an archived paywall changes nothing.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsArchive(string $projectId, string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsArchive($projectId, $paywallId), $fetch);
    }
    /**
     * Restores an archived paywall. Unarchiving a paywall that is not archived changes nothing.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUnarchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsUnarchive(string $projectId, string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsUnarchive($projectId, $paywallId), $fetch);
    }
    /**
     * Lists the paywall's 50 most recent builds, newest first, whatever their status. The deployed one has `isDeployed: true`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListBuildsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListBuildsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListBuildsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListBuildsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListBuildsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsPaywallIdBuildsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsListBuilds(string $projectId, string $paywallId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsListBuilds($projectId, $paywallId, $queryParameters), $fetch);
    }
    /**
     * Starts building the paywall's current design in the background and answers 202 with the build `building`; read it with `getBuild` until it is `ready` or `failed`, then deploy it. Fails with `conflict` (`paywall_document_changed`) when the design has changed since the `documentVersion` given; nothing is built then. Only a person can start a build, because a build records who started it. Fails with `permission_denied` (`person_credential_required`) for a project secret key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsCreateBuild(string $projectId, string $paywallId, \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsCreateBuild($projectId, $paywallId, $requestBody), $fetch);
    }
    /**
     * Reads one build of the paywall. Fails with `not_found` (`paywall_build_not_found`) when the paywall has no such build.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $buildId The build's id, `pw_build_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsGetBuild(string $projectId, string $paywallId, string $buildId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsGetBuild($projectId, $paywallId, $buildId), $fetch);
    }
    /**
     * Deploys a ready build: every location showing the paywall shows it from now on, and deploying an older build rolls back to it. Fails with `conflict` (`paywall_build_not_ready`) while the build is `building` or after it `failed`, and `conflict` (`paywall_build_components_unavailable`) when a component it embeds was yanked, deprecated, deleted or uninstalled since it was built; the message names each one.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $buildId The build's id, `pw_build_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeployBuildBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeployBuildUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeployBuildForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeployBuildNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeployBuildConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeployBuildInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsDeployBuild(string $projectId, string $paywallId, string $buildId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsDeployBuild($projectId, $paywallId, $buildId), $fetch);
    }
    /**
     * Lists the project's perks, or the one with a `slug`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "slug"?: string, //Only the perk with this slug; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PerksListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPerksGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function perksList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a perk. Fails with `conflict` (`perk_slug_taken`) when the slug is in use.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function perksCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a perk. Every product stops granting it, and everyone who holds it loses it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $perkId The perk's id, `perk_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function perksDelete(string $projectId, string $perkId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksDelete($projectId, $perkId), $fetch);
    }
    /**
     * Reads one perk.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $perkId The perk's id, `perk_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function perksGet(string $projectId, string $perkId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksGet($projectId, $perkId), $fetch);
    }
    /**
     * Renames a perk or changes its slug. Fails with `conflict` (`perk_slug_taken`) when another perk in the project uses the slug.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $perkId The perk's id, `perk_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function perksUpdate(string $projectId, string $perkId, \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksUpdate($projectId, $perkId, $requestBody), $fetch);
    }
    /**
     * Lists the project's persons, newest first, optionally only the one with a `distinctId` or those with an `email`. Fails with `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "distinctId"?: string, //Only the person with this distinct id; the page then holds at most one.
     *    "email"?: string, //Only persons with this email address, matched without regard to case.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a person for a distinct id. When a person already has the distinct id, writes the given email and name onto them and returns them instead of creating another.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Reads one person. The id of a person merged into another reads the person they were merged into. Fails with `not_found` (`person_not_found`) for an unknown or erased person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsGet(string $projectId, string $personId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsGet($projectId, $personId), $fetch);
    }
    /**
     * Changes a person's email, name or traits. The newest write of a trait in `traits` wins; a trait in `setOnce` is kept only when the person has none yet. Fails with `not_found` (`person_not_found`) for an unknown or erased person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsUpdate(string $projectId, string $personId, \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsUpdate($projectId, $personId, $requestBody), $fetch);
    }
    /**
     * Lists the perks the person can use now, one per perk, including the access of persons merged into them. Each entry names the subscription or purchase that gives the access and when it ends; apps that check a perk through the SDKs see the same access. A secret key counts its own environment; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `not_found` (`person_not_found`) for an unknown or erased person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsListEntitlementsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListEntitlementsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListEntitlementsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListEntitlementsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListEntitlementsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdEntitlementsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsListEntitlements(string $projectId, string $personId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsListEntitlements($projectId, $personId, $queryParameters), $fetch);
    }
    /**
     * Lists the person's one-time purchases, newest first, including those of persons merged into them. A secret key includes its own environment; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `not_found` (`person_not_found`) for an unknown or erased person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPurchasesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPurchasesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPurchasesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPurchasesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPurchasesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdPurchasesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsListPurchases(string $projectId, string $personId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsListPurchases($projectId, $personId, $queryParameters), $fetch);
    }
    /**
     * Lists the person's subscriptions, most recently started first, including those of persons merged into them. A secret key includes its own environment; a person's own credentials choose with `x-environment`: `production` (the default), `test` or `all`. Fails with `not_found` (`person_not_found`) for an unknown or erased person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsListSubscriptionsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListSubscriptionsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListSubscriptionsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListSubscriptionsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListSubscriptionsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdSubscriptionsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsListSubscriptions(string $projectId, string $personId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsListSubscriptions($projectId, $personId, $queryParameters), $fetch);
    }
    /**
     * Permanently erases a person's personal data, and that of every person merged into them, in the background. This cannot be undone. Name the person by exactly one of `personId` or `distinctId`. Fails with `invalid_request` (`erasure_target_required`) with neither, and `invalid_request` (`erasure_target_ambiguous`) with both. Purchases and revenue stay recorded against the anonymized person. Always answers 202 with the erasure: a request naming nobody records an erasure that is `completed` at once with a null `personId`, and repeating a request returns the existing erasure, starting it again when it `failed`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePersonErasureBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateErasureBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateErasureUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateErasureForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateErasureNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateErasureInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonErasureJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsCreateErasure(string $projectId, \Voidhash\Generated\Core\Model\CreatePersonErasureBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsCreateErasure($projectId, $requestBody), $fetch);
    }
    /**
     * Reads an erasure and its progress. Fails with `not_found` (`erasure_not_found`) when the project has no such erasure.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $erasureId The erasure's id, `person_erasure_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetErasureBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetErasureUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetErasureForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetErasureNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetErasureInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonErasureJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsGetErasure(string $projectId, string $erasureId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsGetErasure($projectId, $erasureId), $fetch);
    }
    /**
     * Lists the project's products, optionally only one `type` or the one with a `slug`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "type"?: string, //Only products of this type: `subscription`, `one_time` or `one_time_consumable`.
     *    "slug"?: string, //Only the product with this slug; the page then holds at most one.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function productsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a product. A subscription needs a `billingPeriod`; a one-time product has none. Fails with `conflict` (`product_slug_taken`) when the slug is in use.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function productsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a product. Fails with `conflict` (`product_in_use`) while store products are mapped to it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function productsDelete(string $projectId, string $productId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsDelete($projectId, $productId), $fetch);
    }
    /**
     * Reads one product.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function productsGet(string $projectId, string $productId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsGet($projectId, $productId), $fetch);
    }
    /**
     * Renames a product or changes its slug. Its type and billing period cannot change. Fails with `conflict` (`product_slug_taken`) when another product in the project uses the slug.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function productsUpdate(string $projectId, string $productId, \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsUpdate($projectId, $productId, $requestBody), $fetch);
    }
    /**
     * Lists the perks a purchase of the product gives access to.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListPerksInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsProductIdPerksGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function productsListPerks(string $projectId, string $productId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsListPerks($projectId, $productId, $queryParameters), $fetch);
    }
    /**
     * Stops the product giving access to the perk. Fails with `not_found` (`perk_not_granted`) when it does not grant it.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param string $perkId The id of the perk, `perk_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsRemovePerkBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsRemovePerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsRemovePerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsRemovePerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsRemovePerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function productsRemovePerk(string $projectId, string $productId, string $perkId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsRemovePerk($projectId, $productId, $perkId), $fetch);
    }
    /**
     * Makes a purchase of the product give access to the perk. Adding a perk the product already gives changes nothing.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $productId The product's id, `prod_...`.
     * @param string $perkId The id of the perk, `perk_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsAddPerkBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAddPerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAddPerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAddPerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAddPerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function productsAddPerk(string $projectId, string $productId, string $perkId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsAddPerk($projectId, $productId, $perkId), $fetch);
    }
    /**
     * Lists the organization's projects. Fails with `not_found` (`organization_not_found`) for an organization the credential cannot use.
     * @param string $organizationId The organization's id, `org_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdProjectsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsList(string $organizationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsList($organizationId, $queryParameters), $fetch);
    }
    /**
     * Creates a project with a publishable key. Its slug is derived from the name and made unique within the organization, so it may differ from the name. Only a person can create a project. Fails with `not_found` (`organization_not_found`) for an organization the credential cannot use.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsCreate(string $organizationId, \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsCreate($organizationId, $requestBody), $fetch);
    }
    /**
     * Permanently deletes a project and everything in it: its catalog, keys, people, purchases and analytics. Only a person can delete a project.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsDelete(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsDelete($projectId), $fetch);
    }
    /**
     * Reads one project.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsGet(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsGet($projectId), $fetch);
    }
    /**
     * Renames a project. Its slug never changes. Only a person can rename a project.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsUpdate(string $projectId, \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsUpdate($projectId, $requestBody), $fetch);
    }
    /**
     * Removes the project's logo. Only a person can change the logo. Fails with `unavailable` (`file_storage_unavailable`) when file storage cannot be reached.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsRemoveAvatarBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsRemoveAvatarUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsRemoveAvatarForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsRemoveAvatarNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsRemoveAvatarInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsRemoveAvatarServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsRemoveAvatar(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsRemoveAvatar($projectId), $fetch);
    }
    /**
     * Replaces the project's logo with the PNG, JPEG or WebP image in the body, up to 2 MB, and returns the project with its new `logoUrl`. Only a person can change the logo. Fails with `invalid_request` (`invalid_image`) for an image it refuses, `conflict` (`avatar_busy`) when the image is still being checked or changed at the same time, and `unavailable` (`file_storage_unavailable`) when file storage cannot be reached.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsSetAvatarServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsSetAvatar(string $projectId, \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsSetAvatar($projectId, $requestBody), $fetch);
    }
    /**
     * Reads the project's settings: how purchases reported by another account are shared, whether store sandbox purchases unlock production apps, and the conversion ad spend is measured against.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsGetSettings(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsGetSettings($projectId), $fetch);
    }
    /**
     * Changes the settings in the body; settings left out keep their values. Returns every setting. Paid access sharing and store sandbox changes apply to purchases and requests from then on; the ads key conversion applies to past report ranges too.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsUpdateSettings(string $projectId, \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsUpdateSettings($projectId, $requestBody), $fetch);
    }
    /**
     * Lists the project's push notification configurations, optionally only one `type`, without their credentials.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "type"?: string, //Only configurations for this push service: `fcm` or `apns`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationConfigurationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Adds a push service to the project. It starts disabled; save its settings and credentials with an update that enables it. A project has one configuration per push service. Fails with `conflict` (`push_notification_configuration_exists`) for another.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a push notification configuration; push notifications already sent keep their history. Fails with `not_found` (`push_notification_configuration_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $configurationId The configuration's id, `push_conf_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsDelete(string $projectId, string $configurationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsDelete($projectId, $configurationId), $fetch);
    }
    /**
     * Reads one push notification configuration without its credentials. Fails with `not_found` (`push_notification_configuration_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $configurationId The configuration's id, `push_conf_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsGet(string $projectId, string $configurationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsGet($projectId, $configurationId), $fetch);
    }
    /**
     * Renames, enables or disables a push notification configuration, or changes its settings. Fields left out of `configuration`, credentials included, keep their stored values, so a provider can be enabled without sending its credential again. Enabling validates the settings, while a disabled configuration saves incomplete settings. Fails with `invalid_request` (`invalid_push_notification_configuration`) when enabling with incomplete settings. Fails with `conflict` (`push_notification_configuration_key_taken`) when another configuration of the project uses the same credentials. The last update wins.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $configurationId The configuration's id, `push_conf_...`.
     * @param \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsUpdate(string $projectId, string $configurationId, \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsUpdate($projectId, $configurationId, $requestBody), $fetch);
    }
    /**
     * Reads the project's products, perks, paywall locations and enabled providers, behind a `sha256:<hex>` `ETag`. Answers `304` without a body when `If-None-Match` names the current version.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "if-none-match"?: string, //The `ETag` of a previous response; when the schema has not changed since, the answer is `304` without a body.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function schemaGet(string $projectId, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SchemaGet($projectId, $headerParameters), $fetch);
    }
    /**
     * Reads only the schema's version, to check for changes without the body. Same `ETag` and `If-None-Match` rules as reading the schema.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "if-none-match"?: string, //The `ETag` of a previous response; when the schema has not changed since, the answer is `304` without a body.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetVersionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetVersionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function schemaGetVersion(string $projectId, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SchemaGetVersion($projectId, $headerParameters), $fetch);
    }
    /**
     * Reads the person `x-distinct-id` names, with the perks they can use and their subscriptions and purchases. Fails with `Api/SdkPersonNotFoundError` when no person has the distinct id. The SDKs call the client API for you; prefer them.
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkGetPerson(array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkGetPerson($headerParameters), $fetch);
    }
    /**
     * Identifies the anonymous person `x-distinct-id` names as `distinctId`, your id for the user, merging the two, and returns the identified person. From an identified distinct id it merges nothing and returns the person `distinctId` names, or fails with `Api/SdkPersonNotFoundError` when there is none. Fails with `Api/SdkPersonAlreadyIdentifiedError` when `distinctId` belongs to another identified person.
     * @param \Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonConflictException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkIdentifyPerson(\Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkIdentifyPerson($requestBody, $headerParameters), $fetch);
    }
    /**
     * Writes the email, name and traits of the person `x-distinct-id` names, and returns the person. A retried write with the same `clientEventId` is applied once.
     * @param \Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkSyncPersonAttributes(\Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkSyncPersonAttributes($requestBody, $headerParameters), $fetch);
    }
    /**
     * Reports a store transaction from the device. Voidhash verifies it with the store, records the purchase and grants its perks. One client address may send 300 a minute per project; past that the answer is 429 with a `Retry-After` header. Fails with `Api/SdkTransactionRejectedError` when the store can never accept the transaction as sent.
     * @param mixed $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers. At most 255 characters.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded"?: string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build"?: string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode"?: string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform"?: string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor"?: string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk"?: string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version"?: string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkSyncTransactionResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkSyncTransaction($requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkSyncTransaction($requestBody, $headerParameters), $fetch);
    }
    /**
     * Signs an App Store promotional offer for the person, so the app can buy the product at the offer's price. Fails with `Api/SdkPromotionalOfferUnavailableError` when the App Store is not set up for the app or the product's mapping lists no such offer; do not sell the product at its regular price instead.
     * @param \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkSignPromotionalOfferBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkSignPromotionalOfferUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkSignPromotionalOfferUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\SdkSignPromotionalOfferInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkSignPromotionalOffer(\Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkSignPromotionalOffer($requestBody, $headerParameters), $fetch);
    }
    /**
     * Records a simulated purchase from a debug build in development mode, at the product's development price, as a test purchase. Use the test publishable key.
     * @param \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkDevelopmentPurchaseBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkDevelopmentPurchaseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkDevelopmentPurchaseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkDevelopmentPurchase(\Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkDevelopmentPurchase($requestBody, $headerParameters), $fetch);
    }
    /**
     * Evaluates feature flags for the person `x-distinct-id` names: whether each flag is on, its variant and its value (`payload`).
     * @param \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkEvaluateFeatureFlags(\Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkEvaluateFeatureFlags($requestBody, $headerParameters), $fetch);
    }
    /**
     * Resolves what a paywall location shows the person: the paywall and its deployed build (`paywallRelease`), with where to download it. Answers null when the location does not exist, shows nothing, or shows a build this version of the SDK cannot display.
     * @param \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     *    "x-ui-package-abi"?: string, //The newest flow package format version the SDK's paywall engine reads.
     *    "x-ui-guest-abi"?: string, //The newest component guest ABI version the SDK's paywall engine runs. Without it the other engine headers are ignored and only releases a guest ABI 1 engine without native components can show are served.
     *    "x-ui-native-components"?: string, //The native components the SDK's paywall engine provides, as comma-separated `id@version` entries.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkResolvePaywall(\Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkResolvePaywall($requestBody, $headerParameters), $fetch);
    }
    /**
     * Reads the project's products, perks and paywall locations, keyed by slug, in the shape the SDKs use, with the schema's version. `schema.get` serves the same schema to the management API.
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSdkSchemaBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSdkSchemaUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSdkSchemaInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkGetSdkSchema(array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkGetSdkSchema($headerParameters), $fetch);
    }
    /**
     * Registers the device's push credential for the person `x-distinct-id` names, creating an anonymous person when there is none, and returns the device's id. Fails with `Api/ActionForbiddenError` when push notifications are not turned on for the team.
     * @param \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkRegisterDevice(\Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkRegisterDevice($requestBody, $headerParameters), $fetch);
    }
    /**
     * Replaces the push credential of a device the person registered, keeping its id. Fails with `Api/PushDeviceNotFoundError` when the id is unknown or another person's.
     * @param \Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkRefreshDevice(\Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkRefreshDevice($requestBody, $headerParameters), $fetch);
    }
    /**
     * Stops push notifications to a device the person registered. Fails with `Api/PushDeviceNotFoundError` when the id is unknown or another person's.
     * @param \Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkUnregisterDevice(\Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkUnregisterDevice($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\MeGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\MeGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\MeGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\MeGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\MeJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function meGet(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\MeGet(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\MeRemoveAvatarBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\MeRemoveAvatarUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\MeRemoveAvatarForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\MeRemoveAvatarInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\MeRemoveAvatarServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function meRemoveAvatar(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\MeRemoveAvatar(), $fetch);
    }
    /**
     * Replaces the person's picture with the image in the body and returns their profile. Only a person can change it, and not through an app limited to reading. Fails with `invalid_request` (`invalid_image`) for an image of the wrong type or size, `conflict` (`avatar_busy`) while an earlier upload is still being processed, and `unavailable` (`file_storage_unavailable`) when file storage cannot be reached.
     * @param \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\MeSetAvatarBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\MeSetAvatarUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\MeSetAvatarForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\MeSetAvatarConflictException
     * @throws \Voidhash\Generated\Core\Exception\MeSetAvatarInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\MeSetAvatarServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\MeJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function meSetAvatar(\Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\MeSetAvatar($requestBody), $fetch);
    }
    /**
     * Lists the project's webhooks, without their secrets. Fails with `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdWebhooksGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a webhook and returns it with its signing secret. This response is the only time the secret is shown; rotate it to get a new one. Fails with `invalid_request` (`invalid_webhook_url`) for a URL Voidhash cannot deliver to.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateWebhookBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookWithSecretJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateWebhookBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a webhook and its delivery history.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $webhookId The webhook's id, `wh_ep_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksDelete(string $projectId, string $webhookId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksDelete($projectId, $webhookId), $fetch);
    }
    /**
     * Reads one webhook, without its secret. Fails with `not_found` (`webhook_not_found`) when the project has no such webhook.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $webhookId The webhook's id, `wh_ep_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksGet(string $projectId, string $webhookId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksGet($projectId, $webhookId), $fetch);
    }
    /**
     * Changes a webhook. Setting `status` to `active` resumes a `disabled` or `failed` webhook and clears its failure count. Fails with `invalid_request` (`invalid_webhook_url`) for a URL Voidhash cannot deliver to.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $webhookId The webhook's id, `wh_ep_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateWebhookBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksUpdate(string $projectId, string $webhookId, \Voidhash\Generated\Core\Model\UpdateWebhookBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksUpdate($projectId, $webhookId, $requestBody), $fetch);
    }
    /**
     * Replaces the webhook's signing secret and returns the new one; this response is the only time it is shown. The previous secret stops working at once, so deploy the new one right after rotating.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $webhookId The webhook's id, `wh_ep_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookWithSecretJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksRotate(string $projectId, string $webhookId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksRotate($projectId, $webhookId), $fetch);
    }
    /**
     * Sends a `test.ping` event to the webhook in the background and answers 202 with its delivery, so you can check signing and connectivity. Read the delivery to see how the webhook answered.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $webhookId The webhook's id, `wh_ep_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksTest(string $projectId, string $webhookId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksTest($projectId, $webhookId), $fetch);
    }
    /**
     * Lists the webhook's deliveries, newest first. Fails with `not_found` (`webhook_not_found`) when the project has no such webhook, and `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $webhookId The webhook's id, `wh_ep_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListDeliveriesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListDeliveriesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListDeliveriesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListDeliveriesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListDeliveriesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdWebhooksWebhookIdDeliveriesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksListDeliveries(string $projectId, string $webhookId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksListDeliveries($projectId, $webhookId, $queryParameters), $fetch);
    }
    /**
     * Reads a delivery with every attempt made for it, including the webhook's status codes and response bodies. Fails with `not_found` (`webhook_delivery_not_found`) when the project has no such delivery.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $deliveryId The delivery's id, `wh_del_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetDeliveryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetDeliveryInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksGetDelivery(string $projectId, string $deliveryId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksGetDelivery($projectId, $deliveryId), $fetch);
    }
    /**
     * Sends a `failed` or `exhausted` delivery again in the background and answers 202 with it. Fails with `conflict` (`webhook_delivery_not_retryable`) for a delivery that is pending, in progress or succeeded.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $deliveryId The delivery's id, `wh_del_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryDeliveryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryDeliveryConflictException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryDeliveryInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksRetryDelivery(string $projectId, string $deliveryId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksRetryDelivery($projectId, $deliveryId), $fetch);
    }
    /**
     * Lists the project's automations, newest first; with `isArchived=true`, archived ones too. Fails with `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "isArchived"?: string, //`true` lists archived automations too; they are left out by default.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a draft automation. A draft can be saved with errors, which `issues` lists; nothing runs until it is activated. Fails with `permission_denied` (`automations_not_enabled`) where automations are not turned on.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateAutomationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateAutomationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Lists every trigger and step type with its settings, the events Voidhash records, and what rules and templates can read: everything needed to write a definition.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetCatalogBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetCatalogUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetCatalogForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetCatalogNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetCatalogInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationCatalogJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsGetCatalog(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsGetCatalog($projectId), $fetch);
    }
    /**
     * Lists the cohorts a schedule's audience can name, by name. Fails with `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListCohortsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListCohortsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListCohortsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListCohortsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListCohortsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsCohortsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsListCohorts(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsListCohorts($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads an automation with its draft definition and what is wrong with it. Fails with `not_found` (`automation_not_found`) when the project has no such automation.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsGet(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsGet($projectId, $automationId), $fetch);
    }
    /**
     * Changes an automation. A new `definition` replaces the draft; an active automation keeps running what it was activated with until it is activated again. Fails with `conflict` (`automation_revision_conflict`) when `expectedRevision` is out of date, and `conflict` (`automation_archived`) for an archived automation.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsUpdate(string $projectId, string $automationId, \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsUpdate($projectId, $automationId, $requestBody), $fetch);
    }
    /**
     * Says whether the draft could be activated, listing everything that stops it, including what only this project's data can show, such as a missing push service. For a schedule it estimates the audience. Changes nothing, and is safe to repeat.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsExplainBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsExplainUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsExplainForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsExplainNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsExplainInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationReviewJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsExplain(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsExplain($projectId, $automationId), $fetch);
    }
    /**
     * Walks the draft for one person without sending or changing anything, and reports each step with its templates filled in. Waits are skipped, and a wait for an event times out unless `receivedEvents` names it. Fails with `not_found` (`person_not_found`) for a person the project does not have.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsTestBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsTestUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsTestForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsTestNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsTestConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsTestInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsTest(string $projectId, string $automationId, \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsTest($projectId, $automationId, $requestBody), $fetch);
    }
    /**
     * Publishes the draft as a new version and makes it live, or resumes a paused automation. People already in the flow stay on the version they started on. The caller needs the permissions of the flow's steps, such as sending notifications. Fails with `conflict` (`automation_invalid`) when the draft has errors, which `explain` lists, and `conflict` (`automation_archived`) for an archived automation.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsActivateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsActivateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsActivateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsActivateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsActivateConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsActivateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsActivate(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsActivate($projectId, $automationId), $fetch);
    }
    /**
     * Stops an active automation at once: nobody enters, and people in the flow stay where they are until it is activated again. Fails with `conflict` (`automation_not_active`) for one that is not active.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsPauseBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsPauseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsPauseForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsPauseNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsPauseConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsPauseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsPause(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsPause($projectId, $automationId), $fetch);
    }
    /**
     * Ends an automation and cancels every run still going. Its history stays readable.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsArchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsArchive(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsArchive($projectId, $automationId), $fetch);
    }
    /**
     * Brings an archived automation back as a draft.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsUnarchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsUnarchive(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsUnarchive($projectId, $automationId), $fetch);
    }
    /**
     * Lists what this automation has been activated with, latest first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListVersionsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListVersionsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListVersionsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListVersionsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListVersionsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdVersionsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsListVersions(string $projectId, string $automationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsListVersions($projectId, $automationId, $queryParameters), $fetch);
    }
    /**
     * Counts the automation's runs by outcome and the people who reached each step, across every version. Step counts cover the last 90 days.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetStatsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetStatsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetStatsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetStatsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetStatsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationStatsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsGetStats(string $projectId, string $automationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsGetStats($projectId, $automationId), $fetch);
    }
    /**
     * Lists the automation's runs, newest first, optionally only one person's or those in one `status`. Fails with `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "personId"?: string, //Only the runs of the person with this id.
     *    "status"?: string, //Only runs in this state. `queued` and `waiting` both match every run that has not moved on yet.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdRunsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsListRuns(string $projectId, string $automationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsListRuns($projectId, $automationId, $queryParameters), $fetch);
    }
    /**
     * Takes one person through an active automation now, whatever its trigger and even if they went through it before. This does what the flow does: it sends real notifications. Fails with `conflict` (`automation_not_active`) for an automation that is not active, and `not_found` (`person_not_found`) for a person the project does not have.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateRunBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateRunUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateRunForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateRunNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateRunConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCreateRunInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationRunJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsCreateRun(string $projectId, string $automationId, \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsCreateRun($projectId, $automationId, $requestBody), $fetch);
    }
    /**
     * Reads a run with what happened at each step. Fails with `not_found` (`automation_run_not_found`) when the project has no such run.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $runId The run's id, `auto_run_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetRunBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetRunUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetRunForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetRunNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsGetRunInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsGetRun(string $projectId, string $runId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsGetRun($projectId, $runId), $fetch);
    }
    /**
     * Takes a person out of a flow. Fails with `conflict` (`automation_run_finished`) for a run that already finished.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $runId The run's id, `auto_run_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCancelRunBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCancelRunUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCancelRunForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCancelRunNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCancelRunConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsCancelRunInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationRunJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsCancelRun(string $projectId, string $runId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsCancelRun($projectId, $runId), $fetch);
    }
    /**
     * Tries a failed run again from the step it failed at. Fails with `conflict` (`automation_run_not_retryable`) for a run that did not fail.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $runId The run's id, `auto_run_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AutomationsRetryRunBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsRetryRunUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsRetryRunForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsRetryRunNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsRetryRunConflictException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsRetryRunInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AutomationRunJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function automationsRetryRun(string $projectId, string $runId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AutomationsRetryRun($projectId, $runId), $fetch);
    }
    /**
     * Lists the changes made to the project's configuration, newest first, optionally only those of one `entityType`, `entityId` or `parentEntityId`. Needs permission to read the project's audit log (`project:audit:read`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "entityType"?: string, //Only entries about this kind of entity, such as `product`, `paywall`, `feature_flag` or `api_key`.
     *    "entityId"?: string, //Only entries about the entity with this id.
     *    "parentEntityId"?: string, //Only entries about entities that belong to this one, such as every build of a paywall.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AuditLogListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AuditLogListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AuditLogListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AuditLogListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AuditLogListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAuditLogGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function auditLogList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AuditLogList($projectId, $queryParameters), $fetch);
    }
    /**
     * Lists the organization's members with their roles.
     * @param string $organizationId The organization's id, `org_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdMembersGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationMembersList(string $organizationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationMembersList($organizationId, $queryParameters), $fetch);
    }
    /**
     * Adds a person who already has a Voidhash account to the organization as a `member`, and returns their membership. Adding someone who is already a member keeps their role. Fails with `invalid_request` (`invitee_has_no_account`) when no account has verified the email; invite them instead. An app limited to reading cannot add members.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\InviteOrganizationMemberBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationMembersCreate(string $organizationId, \Voidhash\Generated\Core\Model\InviteOrganizationMemberBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationMembersCreate($organizationId, $requestBody), $fetch);
    }
    /**
     * Removes a member from the organization. Fails with `permission_denied` (`permission_denied`) for the owner, the last administrator and directory-managed members, who cannot be removed. An app limited to reading cannot remove members.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $memberId The membership's id, `member_...`; not the person's `user_...` id.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationMembersDelete(string $organizationId, string $memberId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationMembersDelete($organizationId, $memberId), $fetch);
    }
    /**
     * Reads one membership. Fails with `not_found` (`member_not_found`) when it is not in this organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $memberId The membership's id, `member_...`; not the person's `user_...` id.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationMembersGet(string $organizationId, string $memberId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationMembersGet($organizationId, $memberId), $fetch);
    }
    /**
     * Changes a member's role to `member` or `admin`. The owner's role cannot change here, the last administrator cannot be demoted, and a directory-managed member's role comes from their directory groups. Fails with `permission_denied` (`permission_denied`) for any of these. An app limited to reading cannot change roles.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $memberId The membership's id, `member_...`; not the person's `user_...` id.
     * @param \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationMembersUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationMembersUpdate(string $organizationId, string $memberId, \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationMembersUpdate($organizationId, $memberId, $requestBody), $fetch);
    }
    /**
     * Lists the organization's pending invitations: not yet accepted, revoked or expired, and sent by someone who can still invite people to the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdInvitationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationInvitationsList(string $organizationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationInvitationsList($organizationId, $queryParameters), $fetch);
    }
    /**
     * Invites an email address to join as a `member` (the default) or `admin`, and emails them the link, which this response also returns. Inviting an address again replaces its pending invitation. Fails with `conflict` (`already_member`) when that person already belongs to the organization, and with `rate_limited` (`invitation_limit_reached`) once the organization sent 50 invitations, or you sent 100, in the last 24 hours; revoked invitations count. An app limited to reading cannot invite.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationInvitationWithUrlJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationInvitationsCreate(string $organizationId, \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationInvitationsCreate($organizationId, $requestBody), $fetch);
    }
    /**
     * Revokes a pending invitation, so its link stops working. Fails with `conflict` (`invitation_accepted`) when it was already accepted. An app limited to reading cannot revoke invitations.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $invitationId The invitation's id, `inv_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsDeleteConflictException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationInvitationsDelete(string $organizationId, string $invitationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationInvitationsDelete($organizationId, $invitationId), $fetch);
    }
    /**
     * Reads one pending invitation. Fails with `not_found` (`invitation_not_found`) once it is accepted, revoked or expired, or once whoever sent it can no longer invite people to the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $invitationId The invitation's id, `inv_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationInvitationsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationInvitationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationInvitationsGet(string $organizationId, string $invitationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationInvitationsGet($organizationId, $invitationId), $fetch);
    }
    /**
     * Lists the person's notices in the organization, newest first; `isArchived=true` lists the archive instead. Fails with `invalid_request` (`invalid_cursor`) for a cursor this endpoint did not return.
     * @param string $organizationId The organization's id, `org_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "isArchived"?: string, //`true` lists the archive instead of the inbox. Defaults to `false`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdNoticesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesList(string $organizationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesList($organizationId, $queryParameters), $fetch);
    }
    /**
     * Counts the unread notices in the person's inbox of the organization; archived notices are not counted.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetUnreadCountBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetUnreadCountUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetUnreadCountForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetUnreadCountNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetUnreadCountInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\NoticeUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesGetUnreadCount(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesGetUnreadCount($organizationId), $fetch);
    }
    /**
     * Marks notices read, or without `noticeIds` every notice in the inbox, and returns the unread count after the change. Ids of notices the person does not have are ignored, so repeating the request changes nothing.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\MarkNoticesReadBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesMarkReadBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesMarkReadUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesMarkReadForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesMarkReadNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesMarkReadInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\NoticeUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesMarkRead(string $organizationId, \Voidhash\Generated\Core\Model\MarkNoticesReadBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesMarkRead($organizationId, $requestBody), $fetch);
    }
    /**
     * Archives notices, which also marks them read, and returns the unread count after the change. Ids of notices the person does not have are ignored.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\NoticeSelectionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesArchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\NoticeUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesArchive(string $organizationId, \Voidhash\Generated\Core\Model\NoticeSelectionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesArchive($organizationId, $requestBody), $fetch);
    }
    /**
     * Brings archived notices back to the inbox and returns the unread count after the change. They stay read. Ids of notices the person does not have are ignored.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\NoticeSelectionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUnarchiveInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\NoticeUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesUnarchive(string $organizationId, \Voidhash\Generated\Core\Model\NoticeSelectionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesUnarchive($organizationId, $requestBody), $fetch);
    }
    /**
     * Reads the person's notice language and, per category, which channels deliver its notices from the organization.
     * @param string $organizationId The organization's id, `org_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetPreferencesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetPreferencesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetPreferencesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetPreferencesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesGetPreferencesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\NoticePreferencesJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesGetPreferences(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesGetPreferences($organizationId), $fetch);
    }
    /**
     * Changes which channels deliver each category of the organization's notices, and the person's notice language, which applies in every organization; returns the preferences. Billing, legal and security notices cannot be muted. Fails with `invalid_request` (`notice_category_mandatory`) when turning one off.
     * @param string $organizationId The organization's id, `org_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateNoticePreferencesBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NoticesUpdatePreferencesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUpdatePreferencesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUpdatePreferencesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUpdatePreferencesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NoticesUpdatePreferencesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\NoticePreferencesJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function noticesUpdatePreferences(string $organizationId, \Voidhash\Generated\Core\Model\UpdateNoticePreferencesBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NoticesUpdatePreferences($organizationId, $requestBody), $fetch);
    }
    /**
     * Lists a folder's contents (the top level without `parentId`), folders first and then by name. `sort=recent` lists every board by last change instead, and `isArchived=true` lists the trash. Fails with `not_found` (`file_not_found`) for a folder that isn't there or is in the trash.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "parentId"?: string,
     *    "kind"?: string,
     *    "isArchived"?: string,
     *    "sort"?: string,
     *    "search"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFilesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function filesList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesList($projectId, $queryParameters), $fetch);
    }
    /**
     * Creates a folder or a board, at the top level or inside the folder `parentId`. A new board starts with the columns Backlog, Todo, In progress and Done. Fails with `conflict` (`file_conflict`) when `parentId` isn't a folder.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateFileBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesCreateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FileEntryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function filesCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateFileBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes something in the trash for good, with everything inside it. Only a person, signed in to Voidhash, can do this: an app or bot acting for them fails with `permission_denied`. Something not in the trash fails with `conflict` (`file_conflict`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fileId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteConflictException
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesDeleteServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function filesDelete(string $projectId, string $fileId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesDelete($projectId, $fileId), $fetch);
    }
    /**
     * Reads a folder or file, with the folders above it. Something in the trash, or inside a folder that is, answers `not_found` (`file_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fileId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesGetInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesGetServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FileWithPathJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function filesGet(string $projectId, string $fileId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesGet($projectId, $fileId), $fetch);
    }
    /**
     * Renames a folder or file, or moves it to another folder; `parentId: null` moves it to the top level. Fails with `conflict` (`file_conflict`) when a folder would move into itself.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fileId
     * @param \Voidhash\Generated\Core\Model\UpdateFileBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesUpdateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FileEntryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function filesUpdate(string $projectId, string $fileId, \Voidhash\Generated\Core\Model\UpdateFileBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesUpdate($projectId, $fileId, $requestBody), $fetch);
    }
    /**
     * Moves a folder or file to the trash, with everything inside it. After 30 days there it is deleted for good. A bot can only do this to what it created (`permission_denied`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fileId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesArchiveServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FileEntryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function filesArchive(string $projectId, string $fileId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesArchive($projectId, $fileId), $fetch);
    }
    /**
     * Takes a folder or file out of the trash. It goes back where it was, or to the top level when that folder is in the trash too.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fileId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\FilesUnarchiveServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FileEntryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function filesUnarchive(string $projectId, string $fileId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FilesUnarchive($projectId, $fileId), $fetch);
    }
    /**
     * Lists the project's assets, newest first. `kind` keeps one kind, `search` those whose name contains it, and `url` the one served from that URL.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "kind"?: string, //Only assets of this kind: `image`, `video`, `font` or `document`.
     *    "search"?: string, //Only assets whose name contains this, matched without regard to case.
     *    "url"?: string, //Only the asset served from exactly this URL, such as an image a task description shows.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AssetsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AssetsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AssetsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AssetsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AssetsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAssetsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function assetsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AssetsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads one asset, with the public URL it is served from. Fails with `not_found` (`asset_not_found`) for an id the project has no asset under.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $assetId The asset's id, `asset_...` or `pw_asset_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AssetJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function assetsGet(string $projectId, string $assetId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AssetsGet($projectId, $assetId), $fetch);
    }
    /**
     * Shows an image asset as a model can look at it: upright, at most 1568 pixels on its longest side, as base64 JPEG. Fails with `not_found` (`asset_not_found`), `invalid_request` (`image_unreadable`) for an asset that is not a JPEG, PNG, WebP or GIF image, and `invalid_request` (`image_too_large`) for one over 30 MB.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $assetId The asset's id, `asset_...` or `pw_asset_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function assetsGetPreview(string $projectId, string $assetId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AssetsGetPreview($projectId, $assetId), $fetch);
    }
    /**
     * Lists who can be assigned to a task or mentioned in a comment: the members of the project's organization, then the bots added to the project. A person's own assistant bot isn't here: it acts as that person.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ParticipantsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ParticipantsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ParticipantsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ParticipantsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ParticipantsListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ParticipantsListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdParticipantsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function participantsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ParticipantsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads a board's columns, with how many tasks each holds, and its labels. `boards.listTasks` reads the tasks.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsGet(string $projectId, string $boardId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsGet($projectId, $boardId), $fetch);
    }
    /**
     * Lists a board's tasks in board order, narrowed by column, assignee, label, priority or text. Archived tasks are listed only with `isArchived=true`, and then only they are.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "columnId"?: string,
     *    "assignee"?: string,
     *    "labelId"?: string,
     *    "priority"?: string,
     *    "isArchived"?: string,
     *    "text"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdBoardsBoardIdTasksGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsListTasks(string $projectId, string $boardId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsListTasks($projectId, $boardId, $queryParameters), $fetch);
    }
    /**
     * Adds a task to the end of a column, the board's first when `columnId` is left out. Repeating a create with the same `Idempotency-Key` header returns the first task instead of adding another. Assignees must be members of the project's organization or bots added to the project (`assignee_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding $requestBody
     * @param array{
     *    "idempotency-key"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsCreateTask(string $projectId, string $boardId, \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsCreateTask($projectId, $boardId, $requestBody, $headerParameters), $fetch);
    }
    /**
     * Reads one task, archived or not.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $taskId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetTaskBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetTaskUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetTaskForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetTaskNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetTaskInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsGetTaskServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsGetTask(string $projectId, string $boardId, string $taskId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsGetTask($projectId, $boardId, $taskId), $fetch);
    }
    /**
     * Changes a task in one write: its title, description, assignees, labels, priority and due date, and moves it with `columnId`, `afterTaskId` or `beforeTaskId`. `assignees` and `labelIds` replace the current ones.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $taskId
     * @param \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateTaskServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsUpdateTask(string $projectId, string $boardId, string $taskId, \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsUpdateTask($projectId, $boardId, $taskId, $requestBody), $fetch);
    }
    /**
     * Takes a task off the board. It keeps its comments and can come back with `boards.unarchiveTask`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $taskId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsArchiveTaskServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsArchiveTask(string $projectId, string $boardId, string $taskId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsArchiveTask($projectId, $boardId, $taskId), $fetch);
    }
    /**
     * Brings an archived task back to the board.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $taskId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUnarchiveTaskServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsUnarchiveTask(string $projectId, string $boardId, string $taskId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsUnarchiveTask($projectId, $boardId, $taskId), $fetch);
    }
    /**
     * Adds a column, at the end or right after `afterColumnId`. `kind` says what being in it means: `backlog`, `todo`, `in_progress`, `done` or `canceled`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param \Voidhash\Generated\Core\Model\CreateBoardColumnBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateColumnServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardColumnJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsCreateColumn(string $projectId, string $boardId, \Voidhash\Generated\Core\Model\CreateBoardColumnBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsCreateColumn($projectId, $boardId, $requestBody), $fetch);
    }
    /**
     * Deletes a column, moving its tasks to the column `moveTasksTo`. A board's last column can't be deleted, since there would be nowhere to move them.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $columnId
     * @param array{
     *    "moveTasksTo": string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsDeleteColumn(string $projectId, string $boardId, string $columnId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsDeleteColumn($projectId, $boardId, $columnId, $queryParameters), $fetch);
    }
    /**
     * Renames a column, changes its `kind`, or moves it to right after `afterColumnId`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $columnId
     * @param \Voidhash\Generated\Core\Model\UpdateBoardColumnBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateColumnServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardColumnJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsUpdateColumn(string $projectId, string $boardId, string $columnId, \Voidhash\Generated\Core\Model\UpdateBoardColumnBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsUpdateColumn($projectId, $boardId, $columnId, $requestBody), $fetch);
    }
    /**
     * Adds a label to the board.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param \Voidhash\Generated\Core\Model\CreateBoardLabelBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateLabelServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardLabelJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsCreateLabel(string $projectId, string $boardId, \Voidhash\Generated\Core\Model\CreateBoardLabelBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsCreateLabel($projectId, $boardId, $requestBody), $fetch);
    }
    /**
     * Deletes a label and takes it off every task.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $labelId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteLabelServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsDeleteLabel(string $projectId, string $boardId, string $labelId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsDeleteLabel($projectId, $boardId, $labelId), $fetch);
    }
    /**
     * Renames or recolors a label.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $labelId
     * @param \Voidhash\Generated\Core\Model\UpdateBoardLabelBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsUpdateLabelServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\BoardLabelJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function boardsUpdateLabel(string $projectId, string $boardId, string $labelId, \Voidhash\Generated\Core\Model\UpdateBoardLabelBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\BoardsUpdateLabel($projectId, $boardId, $labelId, $requestBody), $fetch);
    }
    /**
     * Lists one thing's comments, oldest first. Fails with `invalid_request` (`comment_subject_invalid`) for a subject type that can't have comments, and `not_found` (`comment_subject_not_found`) for something that isn't there.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "subjectType": string,
     *    "subjectId": string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\CommentsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\CommentsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\CommentsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\CommentsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\CommentsListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\CommentsListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdCommentsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function commentsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\CommentsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Adds a comment as the caller. Mention someone by writing `<@user:abc>` or `<@bot:key>` in `body`, with an id from `participants.list`; a mention of anyone else stays as text and reaches no one.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\CommentsCreateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\CommentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function commentsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\CommentsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Deletes a comment, and its replies when it starts a thread. Its author can, and whoever may manage the organization (`permission_denied`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $commentId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteConflictException
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\CommentsDeleteServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function commentsDelete(string $projectId, string $commentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\CommentsDelete($projectId, $commentId), $fetch);
    }
    /**
     * Changes a comment. Only its author can (`permission_denied`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $commentId
     * @param \Voidhash\Generated\Core\Model\UpdateCommentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateConflictException
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\CommentsUpdateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\CommentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function commentsUpdate(string $projectId, string $commentId, \Voidhash\Generated\Core\Model\UpdateCommentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\CommentsUpdate($projectId, $commentId, $requestBody), $fetch);
    }
    /**
     * Takes the caller's reaction with one emoji off a comment.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $commentId
     * @param string $emoji
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionConflictException
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\CommentsRemoveReactionServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function commentsRemoveReaction(string $projectId, string $commentId, string $emoji, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\CommentsRemoveReaction($projectId, $commentId, $emoji), $fetch);
    }
    /**
     * Reacts to a comment as the caller with one emoji (URL-encoded); reacting again with it changes nothing. Anything but an emoji fails with `invalid_request`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $commentId
     * @param string $emoji
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionConflictException
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\CommentsAddReactionServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\CommentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function commentsAddReaction(string $projectId, string $commentId, string $emoji, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\CommentsAddReaction($projectId, $commentId, $emoji), $fetch);
    }
    /**
     * Lists who follows one thing, earliest first, and why.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "subjectType": string,
     *    "subjectId": string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdSubscriptionsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function subscriptionsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SubscriptionsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Stops following something as the caller, until they are mentioned in it or assigned it again.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $subjectType
     * @param string $subjectId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveConflictException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsRemoveServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function subscriptionsRemove(string $projectId, string $subjectType, string $subjectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SubscriptionsRemove($projectId, $subjectType, $subjectId), $fetch);
    }
    /**
     * Follows something as the caller, whatever they chose before. `subjectId` is URL-encoded.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $subjectType
     * @param string $subjectId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddConflictException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\SubscriptionsAddServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SubscriptionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function subscriptionsAdd(string $projectId, string $subjectType, string $subjectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SubscriptionsAdd($projectId, $subjectType, $subjectId), $fetch);
    }
    /**
     * Lists one thing's activity, oldest first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "subjectType": string,
     *    "subjectId": string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ActivityListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ActivityListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ActivityListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ActivityListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ActivityListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ActivityListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdActivityGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function activityList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ActivityList($projectId, $queryParameters), $fetch);
    }
    /**
     * Lists the caller's inbox, latest first; `isUnread=true` leaves out what they've read, and `isArchived=true` lists the archive instead.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "isUnread"?: string,
     *    "isArchived"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\InboxListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\InboxListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\InboxListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\InboxListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\InboxListInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\InboxListServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdInboxGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function inboxList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\InboxList($projectId, $queryParameters), $fetch);
    }
    /**
     * Counts what the caller hasn't read, archived items aside.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\InboxGetUnreadCountBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\InboxGetUnreadCountUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\InboxGetUnreadCountForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\InboxGetUnreadCountNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\InboxGetUnreadCountInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\InboxGetUnreadCountServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function inboxGetUnreadCount(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\InboxGetUnreadCount($projectId), $fetch);
    }
    /**
     * Marks items read, or without `itemIds` the whole inbox, and returns the unread count after.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\MarkInboxReadBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadConflictException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkReadServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function inboxMarkRead(string $projectId, \Voidhash\Generated\Core\Model\MarkInboxReadBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\InboxMarkRead($projectId, $requestBody), $fetch);
    }
    /**
     * Marks items unread and returns the unread count after.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadConflictException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\InboxMarkUnreadServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function inboxMarkUnread(string $projectId, \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\InboxMarkUnread($projectId, $requestBody), $fetch);
    }
    /**
     * Archives items, which also marks them read, and returns the unread count after. Anything new about an item brings it back.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\InboxArchiveServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function inboxArchive(string $projectId, \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\InboxArchive($projectId, $requestBody), $fetch);
    }
    /**
     * Brings archived items back to the inbox and returns the unread count after. They stay read.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveConflictException
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\InboxUnarchiveServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function inboxUnarchive(string $projectId, \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\InboxUnarchive($projectId, $requestBody), $fetch);
    }
    /**
     * Lists the person's connected apps that still work, most recently used first. Only a person can list them.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1MeConnectedAppsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function connectedAppsList(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ConnectedAppsList($queryParameters), $fetch);
    }
    /**
     * Disconnects an app: a CLI's key is deleted, and an MCP client must sign in again. Only the person signed in to the dashboard can. Fails with `permission_denied` (`dashboard_session_required`) for any other credential. Fails with `not_found` (`connected_app_not_found`) when the app is no longer connected.
     * @param string $connectedAppId The connected app's id, a UUID, as `GET /me/connected-apps` lists it.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function connectedAppsDelete(string $connectedAppId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ConnectedAppsDelete($connectedAppId), $fetch);
    }
    /**
     * Reads one of the person's connected apps. Fails with `not_found` (`connected_app_not_found`) when it was disconnected or is someone else's.
     * @param string $connectedAppId The connected app's id, a UUID, as `GET /me/connected-apps` lists it.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function connectedAppsGet(string $connectedAppId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ConnectedAppsGet($connectedAppId), $fetch);
    }
    /**
     * Limits a connected app to reading, or lifts the limit. Only the person signed in to the dashboard can. Fails with `permission_denied` (`dashboard_session_required`) for any other credential. Fails with `not_found` (`connected_app_not_found`) when the app is no longer connected.
     * @param string $connectedAppId The connected app's id, a UUID, as `GET /me/connected-apps` lists it.
     * @param \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function connectedAppsUpdate(string $connectedAppId, \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ConnectedAppsUpdate($connectedAppId, $requestBody), $fetch);
    }
    /**
     * Lists the project's tracking domains, oldest first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdTrackingDomainsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function trackingDomainsList(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\TrackingDomainsList($projectId, $queryParameters), $fetch);
    }
    /**
     * Claims a subdomain, such as `t.example.com`, for the project and returns the DNS records to create. The domain starts serving once its DNS proves it belongs to the project; one that does not within seven days is removed. A project has at most five. Fails with `invalid_request` (`invalid_tracking_domain`) for a hostname that cannot be used, one the project already has, or a project at its limit, and with `unavailable` (`tracking_domains_unavailable`) where this deployment does not host tracking domains; proxy the web SDK through your own server there.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreateTrackingDomainBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsCreateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsCreateServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function trackingDomainsCreate(string $projectId, \Voidhash\Generated\Core\Model\CreateTrackingDomainBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\TrackingDomainsCreate($projectId, $requestBody), $fetch);
    }
    /**
     * Stops serving a tracking domain and deletes it. Fails with `internal` when the hosting provider cannot be reached; the domain is kept, so the removal can be retried.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $trackingDomainId The tracking domain's id, `tdom_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsDeleteInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function trackingDomainsDelete(string $projectId, string $trackingDomainId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\TrackingDomainsDelete($projectId, $trackingDomainId), $fetch);
    }
    /**
     * Reads one tracking domain and the DNS records it needs.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $trackingDomainId The tracking domain's id, `tdom_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function trackingDomainsGet(string $projectId, string $trackingDomainId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\TrackingDomainsGet($projectId, $trackingDomainId), $fetch);
    }
    /**
     * Checks the domain's DNS records and certificate now instead of waiting for the next scheduled check, and returns its updated `status`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $trackingDomainId The tracking domain's id, `tdom_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsVerifyBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsVerifyUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsVerifyForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsVerifyNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\TrackingDomainsVerifyInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function trackingDomainsVerify(string $projectId, string $trackingDomainId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\TrackingDomainsVerify($projectId, $trackingDomainId), $fetch);
    }
    /**
     * Lists the campaigns synced from the project's ad accounts, ordered by name. Filter by `adAccountId`, `status`, `deliveryStatus`, `destination`, or `search` (the name, ignoring case, or the exact id). Fails with `invalid_request` (`ad_account_not_connected`) for a filter naming an account the project has not connected. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "adAccountId"?: string, //Only objects of this connected account, `ad_acct_...`; an account the project has not connected fails with `ad_account_not_connected`.
     *    "status"?: string, //Only objects with this status set on the platform: `on`, `paused` or `removed`.
     *    "deliveryStatus"?: string, //Only objects with this delivery status, such as `delivering` or `rejected`.
     *    "destination"?: string, //Only objects whose ads send people here: `website`, `app_store`, `web_to_app` or `mixed`.
     *    "search"?: string, //Only objects whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsCampaignsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function adsListCampaigns(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsListCampaigns($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads one synced campaign by the platform's id. Fails with `not_found` (`campaign_not_found`). Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $campaignId The platform's id of the campaign.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCampaignBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCampaignUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCampaignForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCampaignNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCampaignInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdCampaignJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsGetCampaign(string $projectId, string $campaignId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsGetCampaign($projectId, $campaignId), $fetch);
    }
    /**
     * Lists synced ad groups (Meta: ad sets), ordered by name; `campaignId` lists one campaign's. Filter by `adAccountId`, `status`, `deliveryStatus`, `destination`, or `search` (the name, ignoring case, or the exact id). Fails with `invalid_request` (`ad_account_not_connected`) for a filter naming an account the project has not connected. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "adAccountId"?: string, //Only objects of this connected account, `ad_acct_...`; an account the project has not connected fails with `ad_account_not_connected`.
     *    "status"?: string, //Only objects with this status set on the platform: `on`, `paused` or `removed`.
     *    "deliveryStatus"?: string, //Only objects with this delivery status, such as `delivering` or `rejected`.
     *    "destination"?: string, //Only objects whose ads send people here: `website`, `app_store`, `web_to_app` or `mixed`.
     *    "search"?: string, //Only objects whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     *    "campaignId"?: string, //Only those of this campaign, by the platform's id.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdGroupsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdGroupsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdGroupsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdGroupsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdGroupsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAdGroupsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function adsListAdGroups(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsListAdGroups($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads one synced ad group by the platform's id. Fails with `not_found` (`ad_group_not_found`). Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $adGroupId The platform's id of the ad group (Meta: ad set).
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdGroupBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdGroupUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdGroupForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdGroupNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdGroupInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdGroupJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsGetAdGroup(string $projectId, string $adGroupId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsGetAdGroup($projectId, $adGroupId), $fetch);
    }
    /**
     * Lists synced ads, ordered by name; `campaignId` or `adGroupId` lists those under one. Filter by `adAccountId`, `status`, `deliveryStatus`, `destination`, or `search` (the name, ignoring case, or the exact id). Fails with `invalid_request` (`ad_account_not_connected`) for a filter naming an account the project has not connected. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "adAccountId"?: string, //Only objects of this connected account, `ad_acct_...`; an account the project has not connected fails with `ad_account_not_connected`.
     *    "status"?: string, //Only objects with this status set on the platform: `on`, `paused` or `removed`.
     *    "deliveryStatus"?: string, //Only objects with this delivery status, such as `delivering` or `rejected`.
     *    "destination"?: string, //Only objects whose ads send people here: `website`, `app_store`, `web_to_app` or `mixed`.
     *    "search"?: string, //Only objects whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     *    "campaignId"?: string, //Only those of this campaign, by the platform's id.
     *    "adGroupId"?: string, //Only the ads of this ad group, by the platform's id.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsListAdsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAdsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function adsListAds(string $projectId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsListAds($projectId, $queryParameters), $fetch);
    }
    /**
     * Reads one synced ad by the platform's id, with its landing URL and the tracking parameters it lacks. Fails with `not_found` (`ad_not_found`). Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $adId The platform's id of the ad.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetAdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsGetAd(string $projectId, string $adId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsGetAd($projectId, $adId), $fetch);
    }
    /**
     * Shows one image of a synced creative, by the platform's id, as a model can look at it: an image, a video's poster frame, or the platform's small thumbnail when nothing larger was synced, upright, at most 1568 pixels on its longest side, as base64 JPEG. `media` picks which of its images and videos, from 0. It is fetched from the platform's CDN at the link the last sync stored. Fails with `not_found` (`creative_not_found`), `not_found` (`creative_image_not_found`) when no link to the image was synced or it is hosted outside the platform, `invalid_request` (`media_out_of_range` or `image_unreadable`), `invalid_request` (`image_too_large`) for an image over 30 MB, `unavailable` (`creative_image_expired`) when the platform no longer serves the link, which a later sync renews, and `unavailable` (`creative_image_unavailable`). Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $creativeId The platform's id of the creative.
     * @param array{
     *    "media"?: int, //Which of the creative's images and videos, counted from 0 in the order the creatives report lists its `media`. Defaults to 0.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdCreativePreviewJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsGetCreativePreview(string $projectId, string $creativeId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsGetCreativePreview($projectId, $creativeId, $queryParameters), $fetch);
    }
    /**
     * Reads the project's ads settings: the landing URL prefixes that mark website ads as web-to-app. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsGetSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsGetSettings(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsGetSettings($projectId), $fetch);
    }
    /**
     * Replaces the web-to-app landing URL prefixes. Each is a host with an optional path, such as `example.app/start`; a scheme, `www.` and a trailing slash are ignored. Synced ads' destinations change right away. Fails with `invalid_request` (`invalid_landing_prefix`). Needs `project:ads:manage`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpdateAdSettingsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsUpdateSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsUpdateSettings(string $projectId, \Voidhash\Generated\Core\Model\UpdateAdSettingsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsUpdateSettings($projectId, $requestBody), $fetch);
    }
    /**
     * Delivery and outcomes per campaign, ad group or ad over a range: what the platform reports (spend, impressions, clicks, results) next to the people, payers and revenue Voidhash measured from the signups credited to them. Filtered, sorted and paged, with totals over every matching row, account spend no ad accounts for, and an optional breakdown of each row by placement, country, age, gender, device or surface. Ended and removed objects appear only when they delivered in the range. Platform-reported and Voidhash-measured numbers stay in separate objects; measured numbers need `project:analytics:read` and are null without it. Money is in minor units of `currency`, rates are decimals. Safe to repeat. Fails with `invalid_request` (`invalid_report`) for a range or time zone it cannot report on. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportPerformanceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsReportPerformance(string $projectId, \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsReportPerformance($projectId, $requestBody), $fetch);
    }
    /**
     * Creatives by spend over a range, with what they cost and earned across the ads that show them, and signs of fatigue. Paged. Platform-reported and Voidhash-measured numbers stay in separate objects; measured numbers need `project:analytics:read` and are null without it. Money is in minor units of `currency`, rates are decimals. Safe to repeat. Fails with `invalid_request` (`invalid_report`) for a range or time zone it cannot report on. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AdsCreativesReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCreativesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCreativesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCreativesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCreativesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCreativesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdsCreativesReportJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsReportCreatives(string $projectId, \Voidhash\Generated\Core\Model\AdsCreativesReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsReportCreatives($projectId, $requestBody), $fetch);
    }
    /**
     * Payback by acquisition cohort: ROAS, revenue per payer or payers by day since acquisition, per weekly or monthly cohort and per surface, platform, campaign or ad group. Money is in minor units of `currency`. Safe to repeat. Fails with `invalid_request` (`invalid_report`) for a range or time zone it cannot report on. Needs `project:ads:read` and `project:analytics:read`. Fails with `permission_denied` (`permission_denied`) without `project:analytics:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCohortsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCohortsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCohortsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCohortsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportCohortsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsReportCohorts(string $projectId, \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsReportCohorts($projectId, $requestBody), $fetch);
    }
    /**
     * What changed in the project's ads over a period of up to 7 days, as the hourly syncs found it: decisions (objects created, turned on, paused or removed, and budget and bid strategy changes) with their values before and after; what each campaign, ad group or ad delivered between syncs, normally per hour; and the platform's revisions of days that had already ended, mostly conversions attributed late. Everything is as the platform reports it, in each ad account's currency (minor units) and time zone. History starts when Voidhash began keeping it (`historySince`). The most recent 2,000 deliveries and revisions are kept, with a `too_many_objects` warning when there were more. Safe to repeat. Fails with `invalid_request` (`invalid_report`) for a period it cannot report on. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AdsReportChangesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportChangesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportChangesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportChangesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsReportChangesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function adsReportChanges(string $projectId, \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AdsReportChanges($projectId, $requestBody), $fetch);
    }
    /**
     * Reads the project's Meta measurement settings: whether the install referrer key is set, how purchases reach Meta's Conversions API, when Meta last took some and the last error. Secrets are never returned, only whether they are set. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementGetSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementGetSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementGetSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementGetSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementGetSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function metaMeasurementGetSettings(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\MetaMeasurementGetSettings($projectId), $fetch);
    }
    /**
     * Changes the fields it names; `null` removes one. Secrets are stored encrypted and never returned. Conversions go only for people whose `$ad_data_sharing` trait is `true`, and turning them on sends only purchases made from then on. Fails with `invalid_request` (`conversions_not_configured`) to turn conversions on without both a dataset and a token, and `invalid_request` (`invalid_install_referrer_key`, `invalid_dataset_id`, `invalid_conversions_token` or `invalid_test_event_code`) for a malformed value, with `param` naming the field. Needs `project:ads:manage`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\MetaMeasurementUpdateSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function metaMeasurementUpdateSettings(string $projectId, \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\MetaMeasurementUpdateSettings($projectId, $requestBody), $fetch);
    }
    /**
     * Lists the latest import of each environment, optionally of one `environment`; a running import is always the latest. Fails with `not_found` (`payment_provider_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "environment"?: string, //Only the import of this environment, `production` or `test`.
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsListBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsListUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsListForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsListNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsListInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdImportsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderHistoryImportsList(string $projectId, string $paymentProviderId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderHistoryImportsList($projectId, $paymentProviderId, $queryParameters), $fetch);
    }
    /**
     * Starts importing the history of one environment and answers 202 with the import `running`; follow it with `GET .../imports/{importId}`. Stripe and payment sources can import. Fails with `invalid_request` (`history_import_unsupported`) for another provider. Each environment runs one import at a time, and an import reads with the saved Stripe API key or payment source endpoint. Fails with `conflict` (`history_import_blocked`) otherwise, with a message saying what to do.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderHistoryImportBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCreateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCreateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderHistoryImport : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderHistoryImportsCreate(string $projectId, string $paymentProviderId, \Voidhash\Generated\Core\Model\CreatePaymentProviderHistoryImportBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderHistoryImportsCreate($projectId, $paymentProviderId, $requestBody), $fetch);
    }
    /**
     * Reads an import, to follow its progress. Only the latest import of each environment can be read. Fails with `not_found` (`history_import_not_found`) for an earlier one or an import of another provider.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $importId The import's id, `pp_import_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsGetBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsGetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsGetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsGetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsGetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderHistoryImport : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderHistoryImportsGet(string $projectId, string $paymentProviderId, string $importId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderHistoryImportsGet($projectId, $paymentProviderId, $importId), $fetch);
    }
    /**
     * Cancels a running import. Items being applied finish and are counted; no further step starts. Canceling an import that already ended returns it unchanged. Only the latest import of an environment can be addressed. Fails with `not_found` (`history_import_not_found`) for the others.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $importId The import's id, `pp_import_...`.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCancelBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCancelUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCancelForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCancelNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsCancelInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderHistoryImport : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderHistoryImportsCancel(string $projectId, string $paymentProviderId, string $importId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderHistoryImportsCancel($projectId, $paymentProviderId, $importId), $fetch);
    }
    /**
     * Sends feedback to the Voidhash team as the signed-in person. Only a person can send it. An `organizationId` or `projectId` the person cannot use is left out rather than recorded.
     * @param \Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeedbackCreateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\FeedbackCreateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeedbackCreateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeedbackCreateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeedbackJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function feedbackCreate(\Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeedbackCreate($requestBody), $fetch);
    }
    /**
     * Runs one read-only VoidQL `SELECT` over the project and returns up to `limit` rows (100 by default, at most 10,000) with `isTruncated` when there were more. `getSchema` lists the tables and their columns. Running a query changes nothing, so it is safe to repeat. Personal data (people's email, name and traits, and event keys that identify a person, such as `properties.$email` or `context.$ip`) needs the `project:persons:read` permission as well. A query runs for at most 20 seconds. Fails with `invalid_request` (`voidql_syntax`, `voidql_unsupported`, `voidql_unknown_relation`, `voidql_unknown_field`, `voidql_too_complex` or `voidql_rejected`) with a message saying what to change, where `param` names the field of an unknown one and a rejection names the database's error code; `permission_denied` (`personal_data`) for personal data without the permission; `rate_limited` (`voidql_quota`) when the organization runs too many queries; and `unavailable` (`voidql_timeout`, `voidql_memory` or `voidql_unavailable`) when the query could not finish.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function voidqlQuery(string $projectId, \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\VoidqlQuery($projectId, $requestBody), $fetch);
    }
    /**
     * Checks a VoidQL `SELECT` and explains it without running it: the columns it would return and whether each can be NULL, the tables it reads (`relations`), the projects it covers, whether it reads personal data, and the database's index-based estimate of the rows it would scan (`null` when it cannot estimate). The database checks the query without reading data, so it fails like `query` for a query that does not compile or that the database would refuse (`voidql_rejected`). Use it to check a query, or its cost, before `query`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\VoidQlExplainBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlExplainServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function voidqlExplain(string $projectId, \Voidhash\Generated\Core\Model\VoidQlExplainBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\VoidqlExplain($projectId, $requestBody), $fetch);
    }
    /**
     * The tables (`relations`) a VoidQL query can read, each with its columns (type, description, whether it is personal data, and the column it refers to, such as `subscriptions.person_id` → `people.id`), its JSON namespaces, and the functions a query may call. Money columns are integer minor units: `*_amount` in the row's `currency`, `*_usd` in US cents.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\VoidqlGetSchemaBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlGetSchemaUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlGetSchemaForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlGetSchemaNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlGetSchemaInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function voidqlGetSchema(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\VoidqlGetSchema($projectId), $fetch);
    }
    public static function create($httpClient = null, array $additionalPlugins = [], array $additionalNormalizers = [])
    {
        if (null === $httpClient) {
            $httpClient = \Http\Discovery\Psr18ClientDiscovery::find();
            $plugins = [];
            if (count($additionalPlugins) > 0) {
                $plugins = array_merge($plugins, $additionalPlugins);
            }
            $httpClient = new \Http\Client\Common\PluginClient($httpClient, $plugins);
        }
        $requestFactory = \Http\Discovery\Psr17FactoryDiscovery::findRequestFactory();
        $streamFactory = \Http\Discovery\Psr17FactoryDiscovery::findStreamFactory();
        $normalizers = [new \Symfony\Component\Serializer\Normalizer\ArrayDenormalizer(), new \Voidhash\Generated\Core\Normalizer\JaneObjectNormalizer()];
        if (count($additionalNormalizers) > 0) {
            $normalizers = array_merge($normalizers, $additionalNormalizers);
        }
        $serializer = new \Symfony\Component\Serializer\Serializer($normalizers, [new \Symfony\Component\Serializer\Encoder\JsonEncoder(new \Symfony\Component\Serializer\Encoder\JsonEncode(), new \Symfony\Component\Serializer\Encoder\JsonDecode(['json_decode_associative' => true]))]);
        return new static($httpClient, $requestFactory, $serializer, $streamFactory);
    }
}