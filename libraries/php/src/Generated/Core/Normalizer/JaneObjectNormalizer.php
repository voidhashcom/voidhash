<?php

namespace Voidhash\Generated\Core\Normalizer;

use Voidhash\Generated\Core\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\Core\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class JaneObjectNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    protected $normalizers = [
        
        \Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InvalidRequestErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\InvalidRequestErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UnauthenticatedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\UnauthenticatedErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InternalErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InternalErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InternalErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\InternalErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PermissionDeniedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\PermissionDeniedErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NotFoundErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\NotFoundErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\VoidQlSchemaResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItem::class => \Voidhash\Generated\Core\Normalizer\VoidQlSchemaResultJsonEncodingRelationsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem::class => \Voidhash\Generated\Core\Normalizer\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItem::class => \Voidhash\Generated\Core\Normalizer\VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UnavailableErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UnavailableErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\UnavailableErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RateLimitedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\RateLimitedErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\VoidQlExplainResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingColumnsItem::class => \Voidhash\Generated\Core\Normalizer\VoidQlExplainResultJsonEncodingColumnsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingRelationsItem::class => \Voidhash\Generated\Core\Normalizer\VoidQlExplainResultJsonEncodingRelationsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingEstimate::class => \Voidhash\Generated\Core\Normalizer\VoidQlExplainResultJsonEncodingEstimateNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingLimits::class => \Voidhash\Generated\Core\Normalizer\VoidQlExplainResultJsonEncodingLimitsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlExplainBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\VoidQlExplainBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\VoidQlQueryResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncodingColumnsItem::class => \Voidhash\Generated\Core\Normalizer\VoidQlQueryResultJsonEncodingColumnsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\VoidQlQueryBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeedbackJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeedbackJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateFeedbackBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderHistoryImport::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderHistoryImportNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderHistoryImportCounts::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderHistoryImportCountsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ConflictErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ConflictErrorJsonEncodingError::class => \Voidhash\Generated\Core\Normalizer\ConflictErrorJsonEncodingErrorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaymentProviderHistoryImportBody::class => \Voidhash\Generated\Core\Normalizer\CreatePaymentProviderHistoryImportBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PageInfo::class => \Voidhash\Generated\Core\Normalizer\PageInfoNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MetaMeasurementSettingsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncodingConversionsWithheld::class => \Voidhash\Generated\Core\Normalizer\MetaMeasurementSettingsJsonEncodingConversionsWithheldNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateMetaMeasurementSettingsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsChangesReportJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem::class => \Voidhash\Generated\Core\Normalizer\AdsChangesReportJsonEncodingAccountsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningTooManyObjects::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningTooManyObjectsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningReachUnavailable::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningReachUnavailableNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningReachLimited::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningReachLimitedNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningBreakdownsNotKept::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningBreakdownsNotKeptNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningRangeIncludesToday::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningRangeIncludesTodayNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningSyncFailed::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningSyncFailedNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningSyncStopped::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningSyncStoppedNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningSyncPending::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningSyncPendingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningTimezoneDiffers::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningTimezoneDiffersNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningNoExchangeRate::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningNoExchangeRateNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportWarningCurrencyConverted::class => \Voidhash\Generated\Core\Normalizer\AdsReportWarningCurrencyConvertedNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsRevision::class => \Voidhash\Generated\Core\Normalizer\AdsRevisionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsConversionChange::class => \Voidhash\Generated\Core\Normalizer\AdsConversionChangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsResultChange::class => \Voidhash\Generated\Core\Normalizer\AdsResultChangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsDeliveryChange::class => \Voidhash\Generated\Core\Normalizer\AdsDeliveryChangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsDecision::class => \Voidhash\Generated\Core\Normalizer\AdsDecisionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsObjectSettings::class => \Voidhash\Generated\Core\Normalizer\AdsObjectSettingsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsObjectSettingsBudget::class => \Voidhash\Generated\Core\Normalizer\AdsObjectSettingsBudgetNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsChangesReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsCohortsReportJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem::class => \Voidhash\Generated\Core\Normalizer\AdsCohortsReportJsonEncodingCohortsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItemValuesItem::class => \Voidhash\Generated\Core\Normalizer\AdsCohortsReportJsonEncodingCohortsItemValuesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingAverage::class => \Voidhash\Generated\Core\Normalizer\AdsCohortsReportJsonEncodingAverageNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem::class => \Voidhash\Generated\Core\Normalizer\AdsCohortsReportJsonEncodingGroupsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortValue::class => \Voidhash\Generated\Core\Normalizer\AdsCohortValueNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsProjectedCohortValue::class => \Voidhash\Generated\Core\Normalizer\AdsProjectedCohortValueNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsCohortsReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCreativesReportJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsCreativesReportJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCreativeRow::class => \Voidhash\Generated\Core\Normalizer\AdsCreativeRowNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCreativeRowCopy::class => \Voidhash\Generated\Core\Normalizer\AdsCreativeRowCopyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem::class => \Voidhash\Generated\Core\Normalizer\AdsCreativeRowMediaItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCreativeRowFatigue::class => \Voidhash\Generated\Core\Normalizer\AdsCreativeRowFatigueNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsCreativesReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsCreativesReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceReportJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingTotals::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceReportJsonEncodingTotalsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceReportJsonEncodingUnallocatedNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsModeledMetrics::class => \Voidhash\Generated\Core\Normalizer\AdsModeledMetricsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsMeasuredMetrics::class => \Voidhash\Generated\Core\Normalizer\AdsMeasuredMetricsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportedMetrics::class => \Voidhash\Generated\Core\Normalizer\AdsReportedMetricsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsReportedMetricsResultsItem::class => \Voidhash\Generated\Core\Normalizer\AdsReportedMetricsResultsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceRow::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceRowNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceRowBreakdownItem::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceRowBreakdownItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncodingSort::class => \Voidhash\Generated\Core\Normalizer\AdsPerformanceReportBodyJsonEncodingSortNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdSettingsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdSettingsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateAdSettingsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateAdSettingsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdCreativePreviewJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdCreativePreviewJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ImagePreviewJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdBudget::class => \Voidhash\Generated\Core\Normalizer\AdBudgetNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdDeliveryReason::class => \Voidhash\Generated\Core\Normalizer\AdDeliveryReasonNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdGroupJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdGroupJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdGroupJsonEncodingLearning::class => \Voidhash\Generated\Core\Normalizer\AdGroupJsonEncodingLearningNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdAmount::class => \Voidhash\Generated\Core\Normalizer\AdAmountNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdCampaignJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdCampaignJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\TrackingDomainJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingDomainDnsRecordJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\TrackingDomainDnsRecordJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateTrackingDomainBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateTrackingDomainBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ConnectedAppJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateConnectedAppBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InboxUnreadCountJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InboxSelectionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MarkInboxReadBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MarkInboxReadBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InboxItemJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InboxItemJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ActivityJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ActivityJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SubscriptionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SubscriptionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CommentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CommentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CommentReactionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CommentReactionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateCommentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateCommentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateCommentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BoardLabelJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\BoardLabelJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateBoardLabelBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateBoardLabelBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateBoardLabelBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateBoardLabelBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BoardColumnJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\BoardColumnJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateBoardColumnBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateBoardColumnBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateBoardColumnBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateBoardColumnBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BoardTaskJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\BoardTaskJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateBoardTaskBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateBoardTaskBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BoardJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\BoardJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BoardColumnSummaryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\BoardColumnSummaryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ParticipantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ParticipantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AssetJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AssetJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FileEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FileEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateFileBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateFileBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateFileBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateFileBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FileWithPathJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FileWithPathJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FilePathEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FilePathEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NoticePreferencesJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NoticePreferencesJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NoticeCategoryPreferenceJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateNoticePreferencesBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateNoticePreferencesBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceChangeJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NoticeCategoryPreferenceChangeJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NoticeUnreadCountJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NoticeUnreadCountJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NoticeSelectionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NoticeSelectionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MarkNoticesReadBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MarkNoticesReadBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\NoticeJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\NoticeJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationInvitationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationInvitationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationInvitationWithUrlJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationInvitationWithUrlJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateOrganizationInvitationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationMemberJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateOrganizationMemberBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InviteOrganizationMemberBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InviteOrganizationMemberBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AuditLogEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AuditLogEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationRunJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationRunJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationContextEvent::class => \Voidhash\Generated\Core\Normalizer\AutomationContextEventNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationRunWithStepsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationRunStepJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateAutomationRunBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationEventInput::class => \Voidhash\Generated\Core\Normalizer\AutomationEventInputNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationStatsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationStatsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationStatsJsonEncodingStepsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItemPortsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationStatsJsonEncodingStepsItemPortsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationVersionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationVersionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationDefinition::class => \Voidhash\Generated\Core\Normalizer\AutomationDefinitionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationVariable::class => \Voidhash\Generated\Core\Normalizer\AutomationVariableNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationSettings::class => \Voidhash\Generated\Core\Normalizer\AutomationSettingsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationDuration::class => \Voidhash\Generated\Core\Normalizer\AutomationDurationNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationNode::class => \Voidhash\Generated\Core\Normalizer\AutomationNodeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationTrigger::class => \Voidhash\Generated\Core\Normalizer\AutomationTriggerNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationIssue::class => \Voidhash\Generated\Core\Normalizer\AutomationIssueNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationTestResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationTestResultJsonEncodingStepsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\TestAutomationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationReviewJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationReviewJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationReviewJsonEncodingAudience::class => \Voidhash\Generated\Core\Normalizer\AutomationReviewJsonEncodingAudienceNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateAutomationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCohortJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationCohortJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingTriggersItem::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingTriggersItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingStepsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItemPortsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingStepsItemPortsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItemOutputsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingStepsItemOutputsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingEventsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingEventsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingContextFieldsItem::class => \Voidhash\Generated\Core\Normalizer\AutomationCatalogJsonEncodingContextFieldsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AutomationField::class => \Voidhash\Generated\Core\Normalizer\AutomationFieldNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateAutomationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateAutomationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryWithAttemptsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookDeliveryAttemptJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookWithSecretJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookWithSecretJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\WebhookJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\WebhookJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateWebhookBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateWebhookBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateWebhookBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateWebhookBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MeJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MeJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AvatarImageBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiAuthServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiNotAuthenticatedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiAuthenticationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiActionForbiddenErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UnregisterDeviceBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiPushDeviceValidationErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RefreshDeviceBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RegisterDeviceResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RegisterDeviceBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSchemaServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSchemaServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfiguration::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingConfigurationNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProviders::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingConfigurationProvidersNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingConfigurationProvidersDevelopmentNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingProperties::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaProductJsonEncodingPropertiesNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSchemaLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSchemaLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterface::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceAction::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceActionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceSignatureField::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceSignatureFieldNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceOutcome::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceOutcomeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceOutput::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceOutputNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceInput::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceInputNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkServiceErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkServiceErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncodingLocation::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallJsonEncodingLocationNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywall::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackageNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackageRuntime::class => \Voidhash\Generated\Core\Normalizer\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackageRuntimeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkResolvePaywallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkFeatureFlagsResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkFeatureFlagResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkFeatureFlagResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\EvaluateFeatureFlagsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkDevelopmentPurchaseResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkDevelopmentPurchaseBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkPromotionalOfferUnavailableErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkPromotionalOfferUnavailableErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkPromotionalOfferSignatureJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkPromotionalOfferSignatureBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkTransactionRejectedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkTransactionRejectedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkRateLimitedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkRateLimitedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSyncTransactionResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSyncTransactionResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSyncAndroidTransactionBody::class => \Voidhash\Generated\Core\Normalizer\SdkSyncAndroidTransactionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPurchasePaywallContext::class => \Voidhash\Generated\Core\Normalizer\SdkPurchasePaywallContextNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSyncIosTransactionBody::class => \Voidhash\Generated\Core\Normalizer\SdkSyncIosTransactionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkPersonNotFoundErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingEntitlements::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingEntitlementsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingPurchases::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingPurchasesNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSnapshotContext::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingSnapshotContextNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSubscriptions::class => \Voidhash\Generated\Core\Normalizer\SdkPersonJsonEncodingSubscriptionsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSubscriptionHistoryEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSubscriptionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSubscriptionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSubscriptionPendingPriceJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSubscriptionPendingPriceJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkPurchaseHistoryEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkPurchaseHistoryEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkEntitlementGrantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkSyncPersonAttributesBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SdkIdentifyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaVersionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectSchemaResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaProductProviderJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaProductProviderJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaPerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativeComponentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaNativeComponentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativePropJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaNativePropJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativeListType::class => \Voidhash\Generated\Core\Normalizer\SchemaNativeListTypeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativeEnumType::class => \Voidhash\Generated\Core\Normalizer\SchemaNativeEnumTypeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativeValueType::class => \Voidhash\Generated\Core\Normalizer\SchemaNativeValueTypeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativeComponentPaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaNativeComponentPaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativeEventJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaNativeEventJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaNativePayloadFieldJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaNativePayloadFieldJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SchemaLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PushNotificationConfigurationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePushNotificationConfigurationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePushNotificationConfigurationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectSettingsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingPaidAccessSharing::class => \Voidhash\Generated\Core\Normalizer\ProjectSettingsJsonEncodingPaidAccessSharingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingStoreSandbox::class => \Voidhash\Generated\Core\Normalizer\ProjectSettingsJsonEncodingStoreSandboxNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingAds::class => \Voidhash\Generated\Core\Normalizer\ProjectSettingsJsonEncodingAdsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateProjectSettingsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing::class => \Voidhash\Generated\Core\Normalizer\UpdateProjectSettingsBodyJsonEncodingPaidAccessSharingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingStoreSandbox::class => \Voidhash\Generated\Core\Normalizer\UpdateProjectSettingsBodyJsonEncodingStoreSandboxNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingAds::class => \Voidhash\Generated\Core\Normalizer\UpdateProjectSettingsBodyJsonEncodingAdsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProjectJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProjectJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateProjectBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateProjectBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PerkJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PerkJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ProductJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ProductJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateProductBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateProductBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonErasureJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonErasureJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePersonErasureBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePersonErasureBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonSubscriptionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonSubscriptionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonPurchasePaymentSource::class => \Voidhash\Generated\Core\Normalizer\PersonPurchasePaymentSourceNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonPurchaseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonPurchaseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonEntitlementJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePersonBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePersonBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePerkBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePerkBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallSupportedLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallSupportedLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationProblem::class => \Voidhash\Generated\Core\Normalizer\LocationProblemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallBuildJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallBuildFailure::class => \Voidhash\Generated\Core\Normalizer\PaywallBuildFailureNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FlowPackageDiagnostic::class => \Voidhash\Generated\Core\Normalizer\FlowPackageDiagnosticNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FlowPackage::class => \Voidhash\Generated\Core\Normalizer\FlowPackageNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallBuildBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaywallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationRulesJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationRulesJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationRuleJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationRuleJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagConditionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagConditionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ReplacePaywallLocationRulesBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncodingRulesItem::class => \Voidhash\Generated\Core\Normalizer\ReplacePaywallLocationRulesBodyJsonEncodingRulesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagConditionInput::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagConditionInputNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationPinJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationPinJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PutPaywallLocationPinBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationShowingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SetPaywallLocationShowingBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationInterfaceSet::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationInterfaceSetNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallLocationAffectedFlow::class => \Voidhash\Generated\Core\Normalizer\PaywallLocationAffectedFlowNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SetPaywallLocationInterfaceBody::class => \Voidhash\Generated\Core\Normalizer\SetPaywallLocationInterfaceBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceActionDraft::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceActionDraftNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FlowInterfaceActionField::class => \Voidhash\Generated\Core\Normalizer\FlowInterfaceActionFieldNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceOutcomeDraft::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceOutcomeDraftNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceOutputDraft::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceOutputDraftNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LocationInterfaceInputDraft::class => \Voidhash\Generated\Core\Normalizer\LocationInterfaceInputDraftNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaywallLocationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallLocationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentSourceSubscription::class => \Voidhash\Generated\Core\Normalizer\PaymentSourceSubscriptionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CancelPaymentSourceSubscriptionBody::class => \Voidhash\Generated\Core\Normalizer\CancelPaymentSourceSubscriptionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody::class => \Voidhash\Generated\Core\Normalizer\RecordPaymentSourceSubscriptionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentSourceCustomer::class => \Voidhash\Generated\Core\Normalizer\PaymentSourceCustomerNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentSourceTransaction::class => \Voidhash\Generated\Core\Normalizer\PaymentSourceTransactionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody::class => \Voidhash\Generated\Core\Normalizer\RefundPaymentSourceTransactionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody::class => \Voidhash\Generated\Core\Normalizer\RecordPaymentSourceTransactionBodyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderProductMappingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductMappingBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaymentProviderProductMappingBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaymentProviderProductMappingBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderUnmappedProduct::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderUnmappedProductNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderCatalogEntryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderCatalogEntryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderCatalogMapping::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderCatalogMappingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentSourceEndpointDescription::class => \Voidhash\Generated\Core\Normalizer\PaymentSourceEndpointDescriptionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentSourceEndpointDescriptionSdk::class => \Voidhash\Generated\Core\Normalizer\PaymentSourceEndpointDescriptionSdkNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaymentProviderJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaymentProviderJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaymentProviderBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaymentProviderBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaymentProviderBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaymentProviderBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\OrganizationSettingsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\OrganizationSettingsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateOrganizationSettingsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateOrganizationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateOrganizationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PushNotificationDeliveryJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PushNotificationDeliveryJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PushNotificationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PushNotificationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcceptedPushNotificationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AcceptedPushNotificationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePushNotificationBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePushNotificationBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CustomEventSettingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CustomEventSettingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpsertCustomEventBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\BuiltinEventSettingJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpsertBuiltinEventBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\IngestPolicyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\IngestPolicyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagOverrideJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PutFeatureFlagOverrideBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagEnvironmentsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagEnvironmentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagServeJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagServeJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagRuleJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagRuleJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagIdentityRef::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagIdentityRefNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentOverrideJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagEnvironmentOverrideJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PutFeatureFlagEnvironmentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingOverridesItem::class => \Voidhash\Generated\Core\Normalizer\PutFeatureFlagEnvironmentBodyJsonEncodingOverridesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem::class => \Voidhash\Generated\Core\Normalizer\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe::class => \Voidhash\Generated\Core\Normalizer\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough::class => \Voidhash\Generated\Core\Normalizer\PutFeatureFlagEnvironmentBodyJsonEncodingFallthroughNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagVariantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagVariantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ReplaceFeatureFlagVariantsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem::class => \Voidhash\Generated\Core\Normalizer\ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateFeatureFlagBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagEvaluationsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagEvaluationsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagEvaluationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagEvaluationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\EvaluateProjectFeatureFlagsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\FeatureFlagEvaluationContext::class => \Voidhash\Generated\Core\Normalizer\FeatureFlagEvaluationContextNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateFeatureFlagBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncodingVariantsItem::class => \Voidhash\Generated\Core\Normalizer\CreateFeatureFlagBodyJsonEncodingVariantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentResultsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentResultsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentVariantResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentVariantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentFlagValue::class => \Voidhash\Generated\Core\Normalizer\ExperimentFlagValueNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentPlacement::class => \Voidhash\Generated\Core\Normalizer\ExperimentPlacementNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ReplaceExperimentVariantsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncodingVariantsItem::class => \Voidhash\Generated\Core\Normalizer\ReplaceExperimentVariantsBodyJsonEncodingVariantsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItem::class => \Voidhash\Generated\Core\Normalizer\ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ExperimentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ConcludeExperimentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateExperimentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateExperimentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsEventJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SandboxActionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SandboxActionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateSandboxActionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateSandboxActionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SandboxStateJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SandboxStateJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SandboxSubscriptionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SandboxSubscriptionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SandboxPurchaseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SandboxPurchaseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SandboxGrantJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SandboxGrantJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SandboxSettingsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SandboxSettingsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateSandboxSettingsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateSandboxSettingsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallComponentUseJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallComponentUseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallComponentVersionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ComponentConformanceResult::class => \Voidhash\Generated\Core\Normalizer\ComponentConformanceResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ComponentConformanceCheck::class => \Voidhash\Generated\Core\Normalizer\ComponentConformanceCheckNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaywallComponentVersionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaywallComponentVersionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallComponentVersionDetailJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PaywallComponentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePaywallComponentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePaywallComponentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallComponentSourceVersionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallComponentSourceVersionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePaywallComponentModuleVersionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentInstallJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePublishedComponentInstallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePublishedComponentInstallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentInstallConsent::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentInstallConsentNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePublishedComponentInstallBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePublishedComponentInstallBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentInstallReviewJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentChange::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentChangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentFileJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentFileJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentVersionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePublishedComponentVersionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdatePublishedComponentBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePublishedComponentPromotionVersionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePublishedComponentPromotionVersionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreatePublishedComponentBundleVersionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentThumbnail::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentThumbnailNormalizer::class,
        
        \Voidhash\Generated\Core\Model\PublishedComponentBundleFile::class => \Voidhash\Generated\Core\Normalizer\PublishedComponentBundleFileNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RegistryPublisherJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RegistryPublisherJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpsertRegistryPublisherBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpsertRegistryPublisherBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevSessionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\DevSessionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevSessionComponentJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\DevSessionComponentJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\DevSessionBuild::class => \Voidhash\Generated\Core\Normalizer\DevSessionBuildNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateDevSessionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateDevSessionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateDevSessionBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateDevSessionBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SessionJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SessionJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SessionProjectJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SessionProjectJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SessionOrganizationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SessionOrganizationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SessionPersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\SessionPersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiKeyWithRawKeyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\RotateApiKeyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ApiKeyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateApiKeyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateApiKeyBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateApiKeyBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsGroupPersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsGroupPersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsGroupJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsGroupJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateAnalyticsGroupBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsGroupTypeJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsGroupTypeJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateAnalyticsGroupTypeBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AddAnalyticsCohortPeopleResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortDefinition::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortDefinitionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortGroupCondition::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortGroupConditionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortCohortCondition::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortCohortConditionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortFirstTimeCondition::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortFirstTimeConditionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortPerformedCondition::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortPerformedConditionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortEventFilter::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortEventFilterNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortEventProperty::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortEventPropertyNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortEventCount::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortEventCountNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortTraitCondition::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortTraitConditionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AddAnalyticsCohortPeopleBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPersonJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPersonJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateAnalyticsCohortBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateAnalyticsCohortBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortEvaluationJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortEvaluationJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\EvaluateAnalyticsCohortBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\EvaluateAnalyticsCohortBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateAnalyticsCohortBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateAnalyticsCohortBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricPoint::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricPointNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricQuery::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricQueryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsGroupDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsGroupDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCohortDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCohortDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPropertyDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPropertyDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsTraitDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsTraitDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPlanDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPlanDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsBillingPeriodDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsBillingPeriodDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsProductDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsProductDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsStoreDimension::class => \Voidhash\Generated\Core\Normalizer\AnalyticsStoreDimensionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricFilter::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricFilterNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsCustomTimeRange::class => \Voidhash\Generated\Core\Normalizer\AnalyticsCustomTimeRangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPresetTimeRange::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPresetTimeRangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsEventMetric::class => \Voidhash\Generated\Core\Normalizer\AnalyticsEventMetricNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsRevenueMetric::class => \Voidhash\Generated\Core\Normalizer\AnalyticsRevenueMetricNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMrrMetric::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMrrMetricNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AnalyticsAlertJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\UpdateAnalyticsAlertBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\CreateAnalyticsAlertBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LiveUsersResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\LiveUsersResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LiveUsersOnSurface::class => \Voidhash\Generated\Core\Normalizer\LiveUsersOnSurfaceNormalizer::class,
        
        \Voidhash\Generated\Core\Model\LiveUsersLocation::class => \Voidhash\Generated\Core\Normalizer\LiveUsersLocationNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\TrackingHealthResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingWeb::class => \Voidhash\Generated\Core\Normalizer\TrackingHealthResultJsonEncodingWebNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingWebHostsItem::class => \Voidhash\Generated\Core\Normalizer\TrackingHealthResultJsonEncodingWebHostsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingAppsItem::class => \Voidhash\Generated\Core\Normalizer\TrackingHealthResultJsonEncodingAppsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingHandoff::class => \Voidhash\Generated\Core\Normalizer\TrackingHealthResultJsonEncodingHandoffNormalizer::class,
        
        \Voidhash\Generated\Core\Model\SdkVersionSeen::class => \Voidhash\Generated\Core\Normalizer\SdkVersionSeenNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AcquisitionCohortsResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionCohortsResultJsonEncodingGroupsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionProjectionModel::class => \Voidhash\Generated\Core\Normalizer\AcquisitionProjectionModelNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionProjectionPlan::class => \Voidhash\Generated\Core\Normalizer\AcquisitionProjectionPlanNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionCohort::class => \Voidhash\Generated\Core\Normalizer\AcquisitionCohortNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionCohortCellsItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionCohortCellsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionCohortProjection::class => \Voidhash\Generated\Core\Normalizer\AcquisitionCohortProjectionNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionCohortsReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AcquisitionCohortsReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingUnattributed::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingUnattributedNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingTotals::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingTotalsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingSelfReportedItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingSelfReportedItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingFunnelItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingFunnelItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingFunnelItemSurfacesItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingFunnelItemSurfacesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingConvertedOn::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingConvertedOnNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingConvertedOnJourneysItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingConvertedOnJourneysItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingCoverageNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportResultJsonEncodingCoverageClassesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionPaymentSurface::class => \Voidhash\Generated\Core\Normalizer\AcquisitionPaymentSurfaceNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionSignupSurface::class => \Voidhash\Generated\Core\Normalizer\AcquisitionSignupSurfaceNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionDay::class => \Voidhash\Generated\Core\Normalizer\AcquisitionDayNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionGroup::class => \Voidhash\Generated\Core\Normalizer\AcquisitionGroupNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AcquisitionReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MetricActorsReportResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MetricActorsReportResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPointActor::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPointActorNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPointGroup::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPointGroupNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsPointPerson::class => \Voidhash\Generated\Core\Normalizer\AnalyticsPointPersonNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MetricActorsReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MetricsReportResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MetricsReportResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricResponseItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricResponseItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricResponseItemResolvedTimeRange::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricResponseItemResolvedTimeRangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsMetricResultSeriesItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsMetricResultSeriesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\MetricsReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\MetricsReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ChartsReportResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ChartsReportResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartResponseItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartResponseItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartResponseItemResolvedTimeRange::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartResponseItemResolvedTimeRangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartOptionsResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\Objects1::class => \Voidhash\Generated\Core\Normalizer\Objects1Normalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartMarkersResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartMarkersResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartMarkersResultMarkersItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartMarkersResultMarkersItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartPointsResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartPointsResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartPointsResultPointsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartPointsResultPointsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartStatsResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartStatsResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartStatsResultStatsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartStatsResultStatsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartFlowResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartFlowResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartFlowResultNodesItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartFlowResultNodesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartFlowResultLinksItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartFlowResultLinksItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartHeatmapResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartHistogramResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResultBinsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartHistogramResultBinsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartCurvesResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResultSeriesItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartCurvesResultSeriesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartCohortsResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResultCohortsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartCohortsResultCohortsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartFunnelResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartFunnelResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartFunnelResultStepsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartFunnelResultStepsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartTableResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartTableResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartTableResultColumnsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartTableResultColumnsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartTableResultRowsItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartTableResultRowsItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartSeriesResult::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartSeriesResultNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartSeriesResultSeriesItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartSeriesResultSeriesItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ChartsReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ChartsReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartQuery::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartQueryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartOptions::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartOptionsNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsChartFilters::class => \Voidhash\Generated\Core\Normalizer\AnalyticsChartFiltersNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InsightsReportResultJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InsightsReportResultJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItem::class => \Voidhash\Generated\Core\Normalizer\AnalyticsInsightResponseItemNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItemResolvedTimeRange::class => \Voidhash\Generated\Core\Normalizer\AnalyticsInsightResponseItemResolvedTimeRangeNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsSummary::class => \Voidhash\Generated\Core\Normalizer\AnalyticsSummaryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsDataPoint::class => \Voidhash\Generated\Core\Normalizer\AnalyticsDataPointNormalizer::class,
        
        \Voidhash\Generated\Core\Model\InsightsReportBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\InsightsReportBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class => \Voidhash\Generated\Core\Normalizer\AnalyticsInsightQueryNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class => \Voidhash\Generated\Core\Normalizer\AnalyticsFilterNotNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class => \Voidhash\Generated\Core\Normalizer\AnalyticsFilterOrNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsFilterAnd::class => \Voidhash\Generated\Core\Normalizer\AnalyticsFilterAndNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class => \Voidhash\Generated\Core\Normalizer\AnalyticsFilterPredicateNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AnalyticsBreakdown::class => \Voidhash\Generated\Core\Normalizer\AnalyticsBreakdownNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AvailableAdAccountsJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncodingToken::class => \Voidhash\Generated\Core\Normalizer\AvailableAdAccountsJsonEncodingTokenNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AvailableAdAccount::class => \Voidhash\Generated\Core\Normalizer\AvailableAdAccountNormalizer::class,
        
        \Voidhash\Generated\Core\Model\QueryAvailableAdAccountsBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\QueryAvailableAdAccountsBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdAccountJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\AdAccountJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\AdAccountJsonEncodingSpendCap::class => \Voidhash\Generated\Core\Normalizer\AdAccountJsonEncodingSpendCapNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ConnectAdAccountBodyJsonEncoding::class => \Voidhash\Generated\Core\Normalizer\ConnectAdAccountBodyJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAccountsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAdsAccountsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsAlertsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAnalyticsAlertsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsCohortsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAnalyticsCohortsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsCohortsCohortIdPeopleGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAnalyticsCohortsCohortIdPeopleGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupTypesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAnalyticsGroupTypesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAnalyticsGroupsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupsGroupIdPeopleGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAnalyticsGroupsGroupIdPeopleGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdApiKeysGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdApiKeysGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentDevSessionsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdComponentDevSessionsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdRegistryComponentsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdRegistryComponentsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdRegistryComponentsRegistryComponentIdVersionsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdRegistryComponentsRegistryComponentIdVersionsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentInstallsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdComponentInstallsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdComponentsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentsComponentIdVersionsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdComponentsComponentIdVersionsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentUsesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdComponentUsesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdEventsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdEventsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdExperimentsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsPutResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsPutResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdFeatureFlagsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsPutResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsPutResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdOverridesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdOverridesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagOverridesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdFeatureFlagOverridesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPushNotificationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationsPushNotificationIdDeliveriesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPushNotificationsPushNotificationIdDeliveriesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaymentProvidersGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdCatalogGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdCatalogGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdUnmappedProductsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdUnmappedProductsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdProductsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdProductsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallLocationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdShowingsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdShowingsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdPinsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdPinsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdRulesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdRulesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsPaywallIdBuildsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallsPaywallIdBuildsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsPaywallIdLocationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaywallsPaywallIdLocationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPerksGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPerksGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPersonsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdEntitlementsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPersonsPersonIdEntitlementsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdPurchasesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPersonsPersonIdPurchasesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdSubscriptionsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPersonsPersonIdSubscriptionsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdProductsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsProductIdPerksGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdProductsProductIdPerksGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdProjectsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsOrganizationIdProjectsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationConfigurationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPushNotificationConfigurationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdWebhooksGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdWebhooksGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdWebhooksWebhookIdDeliveriesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdWebhooksWebhookIdDeliveriesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAutomationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsCohortsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAutomationsCohortsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdVersionsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAutomationsAutomationIdVersionsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdRunsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAutomationsAutomationIdRunsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAuditLogGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAuditLogGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdMembersGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsOrganizationIdMembersGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdInvitationsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsOrganizationIdInvitationsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdNoticesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1OrganizationsOrganizationIdNoticesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFilesGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdFilesGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAssetsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAssetsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdParticipantsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdParticipantsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdBoardsBoardIdTasksGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdBoardsBoardIdTasksGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdCommentsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdCommentsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdSubscriptionsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdSubscriptionsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdActivityGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdActivityGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdInboxGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdInboxGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1MeConnectedAppsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1MeConnectedAppsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdTrackingDomainsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdTrackingDomainsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsCampaignsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAdsCampaignsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAdGroupsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAdsAdGroupsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAdsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdAdsAdsGetResponse200Normalizer::class,
        
        \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdImportsGetResponse200::class => \Voidhash\Generated\Core\Normalizer\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdImportsGetResponse200Normalizer::class,
        
        \Jane\Component\JsonSchemaRuntime\Reference::class => \Voidhash\Generated\Core\Runtime\Normalizer\ReferenceNormalizer::class,
    ], $normalizersCache = [];
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return array_key_exists($type, $this->normalizers);
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && array_key_exists(get_class($data), $this->normalizers);
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $normalizerClass = $this->normalizers[get_class($data)];
        $normalizer = $this->getNormalizer($normalizerClass);
        return $normalizer->normalize($data, $format, $context);
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $denormalizerClass = $this->normalizers[$type];
        $denormalizer = $this->getNormalizer($denormalizerClass);
        return $denormalizer->denormalize($data, $type, $format, $context);
    }
    private function getNormalizer(string $normalizerClass)
    {
        return $this->normalizersCache[$normalizerClass] ?? $this->initNormalizer($normalizerClass);
    }
    private function initNormalizer(string $normalizerClass)
    {
        $normalizer = new $normalizerClass();
        $normalizer->setNormalizer($this->normalizer);
        $normalizer->setDenormalizer($this->denormalizer);
        $this->normalizersCache[$normalizerClass] = $normalizer;
        return $normalizer;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [
            
            \Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\InternalErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\InternalErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NotFoundErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItem::class => false,
            \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem::class => false,
            \Voidhash\Generated\Core\Model\VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItem::class => false,
            \Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UnavailableErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingColumnsItem::class => false,
            \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingRelationsItem::class => false,
            \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingEstimate::class => false,
            \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingLimits::class => false,
            \Voidhash\Generated\Core\Model\VoidQlExplainBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncodingColumnsItem::class => false,
            \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeedbackJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderHistoryImport::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderHistoryImportCounts::class => false,
            \Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ConflictErrorJsonEncodingError::class => false,
            \Voidhash\Generated\Core\Model\CreatePaymentProviderHistoryImportBody::class => false,
            \Voidhash\Generated\Core\Model\PageInfo::class => false,
            \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\MetaMeasurementSettingsJsonEncodingConversionsWithheld::class => false,
            \Voidhash\Generated\Core\Model\UpdateMetaMeasurementSettingsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsChangesReportJsonEncodingAccountsItem::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningTooManyObjects::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningReachUnavailable::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningReachLimited::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningBreakdownsNotKept::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningRangeIncludesToday::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningSyncFailed::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningSyncStopped::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningSyncPending::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningTimezoneDiffers::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningNoExchangeRate::class => false,
            \Voidhash\Generated\Core\Model\AdsReportWarningCurrencyConverted::class => false,
            \Voidhash\Generated\Core\Model\AdsRevision::class => false,
            \Voidhash\Generated\Core\Model\AdsConversionChange::class => false,
            \Voidhash\Generated\Core\Model\AdsResultChange::class => false,
            \Voidhash\Generated\Core\Model\AdsDeliveryChange::class => false,
            \Voidhash\Generated\Core\Model\AdsDecision::class => false,
            \Voidhash\Generated\Core\Model\AdsObjectSettings::class => false,
            \Voidhash\Generated\Core\Model\AdsObjectSettingsBudget::class => false,
            \Voidhash\Generated\Core\Model\AdsChangesReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItemValuesItem::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingAverage::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortValue::class => false,
            \Voidhash\Generated\Core\Model\AdsProjectedCohortValue::class => false,
            \Voidhash\Generated\Core\Model\AdsCohortsReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsCreativesReportJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsCreativeRow::class => false,
            \Voidhash\Generated\Core\Model\AdsCreativeRowCopy::class => false,
            \Voidhash\Generated\Core\Model\AdsCreativeRowMediaItem::class => false,
            \Voidhash\Generated\Core\Model\AdsCreativeRowFatigue::class => false,
            \Voidhash\Generated\Core\Model\AdsCreativesReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingTotals::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceReportJsonEncodingUnallocated::class => false,
            \Voidhash\Generated\Core\Model\AdsModeledMetrics::class => false,
            \Voidhash\Generated\Core\Model\AdsMeasuredMetrics::class => false,
            \Voidhash\Generated\Core\Model\AdsReportedMetrics::class => false,
            \Voidhash\Generated\Core\Model\AdsReportedMetricsResultsItem::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceRow::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceRowBreakdownItem::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncodingSort::class => false,
            \Voidhash\Generated\Core\Model\AdSettingsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateAdSettingsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdCreativePreviewJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdBudget::class => false,
            \Voidhash\Generated\Core\Model\AdDeliveryReason::class => false,
            \Voidhash\Generated\Core\Model\AdGroupJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdGroupJsonEncodingLearning::class => false,
            \Voidhash\Generated\Core\Model\AdAmount::class => false,
            \Voidhash\Generated\Core\Model\AdCampaignJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\TrackingDomainJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\TrackingDomainDnsRecordJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateTrackingDomainBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\InboxUnreadCountJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\InboxSelectionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\MarkInboxReadBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\InboxItemJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ActivityJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SubscriptionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CommentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CommentReactionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateCommentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BoardLabelJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateBoardLabelBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateBoardLabelBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BoardColumnJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateBoardColumnBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateBoardColumnBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BoardTaskJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BoardJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BoardColumnSummaryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ParticipantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AssetJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FileEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateFileBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateFileBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FileWithPathJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FilePathEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NoticePreferencesJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateNoticePreferencesBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceChangeJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NoticeUnreadCountJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NoticeSelectionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\MarkNoticesReadBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\NoticeJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationInvitationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationInvitationWithUrlJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateOrganizationInvitationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationMemberJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateOrganizationMemberBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\InviteOrganizationMemberBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AuditLogEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationRunJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationContextEvent::class => false,
            \Voidhash\Generated\Core\Model\AutomationRunWithStepsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationRunStepJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateAutomationRunBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationEventInput::class => false,
            \Voidhash\Generated\Core\Model\AutomationStatsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItemPortsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationVersionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationDefinition::class => false,
            \Voidhash\Generated\Core\Model\AutomationVariable::class => false,
            \Voidhash\Generated\Core\Model\AutomationSettings::class => false,
            \Voidhash\Generated\Core\Model\AutomationDuration::class => false,
            \Voidhash\Generated\Core\Model\AutomationNode::class => false,
            \Voidhash\Generated\Core\Model\AutomationTrigger::class => false,
            \Voidhash\Generated\Core\Model\AutomationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationIssue::class => false,
            \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem::class => false,
            \Voidhash\Generated\Core\Model\TestAutomationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationReviewJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationReviewJsonEncodingAudience::class => false,
            \Voidhash\Generated\Core\Model\UpdateAutomationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationCohortJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingTriggersItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItemPortsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItemOutputsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingEventsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingContextFieldsItem::class => false,
            \Voidhash\Generated\Core\Model\AutomationField::class => false,
            \Voidhash\Generated\Core\Model\CreateAutomationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookDeliveryAttemptJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookWithSecretJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\WebhookJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateWebhookBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateWebhookBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\MeJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AvatarImageBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiAuthenticationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSchemaServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfiguration::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProviders::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaProductJsonEncodingProperties::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSchemaLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\LocationInterface::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceAction::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceSignatureField::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceOutcome::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceOutput::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceInput::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkServiceErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncodingLocation::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywall::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackageRuntime::class => false,
            \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkFeatureFlagResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkPromotionalOfferUnavailableErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPromotionalOfferSignatureBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkTransactionRejectedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkRateLimitedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSyncTransactionResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSyncAndroidTransactionBody::class => false,
            \Voidhash\Generated\Core\Model\SdkPurchasePaywallContext::class => false,
            \Voidhash\Generated\Core\Model\SdkSyncIosTransactionBody::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkPersonNotFoundErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingEntitlements::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingPurchases::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSnapshotContext::class => false,
            \Voidhash\Generated\Core\Model\SdkPersonJsonEncodingSubscriptions::class => false,
            \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSubscriptionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSubscriptionPendingPriceJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkPurchaseHistoryEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaProductProviderJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaPerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativeComponentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativePropJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativeListType::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativeEnumType::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativeValueType::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativeComponentPaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativeEventJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaNativePayloadFieldJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SchemaLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PushNotificationConfigurationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingPaidAccessSharing::class => false,
            \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingStoreSandbox::class => false,
            \Voidhash\Generated\Core\Model\ProjectSettingsJsonEncodingAds::class => false,
            \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing::class => false,
            \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingStoreSandbox::class => false,
            \Voidhash\Generated\Core\Model\UpdateProjectSettingsBodyJsonEncodingAds::class => false,
            \Voidhash\Generated\Core\Model\ProjectJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PerkJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ProductJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonErasureJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePersonErasureBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonSubscriptionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonPurchasePaymentSource::class => false,
            \Voidhash\Generated\Core\Model\PersonPurchaseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallSupportedLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\LocationProblem::class => false,
            \Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallBuildFailure::class => false,
            \Voidhash\Generated\Core\Model\FlowPackageDiagnostic::class => false,
            \Voidhash\Generated\Core\Model\FlowPackage::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationRulesJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationRuleJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagConditionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncodingRulesItem::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagConditionInput::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationPinJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationInterfaceSet::class => false,
            \Voidhash\Generated\Core\Model\PaywallLocationAffectedFlow::class => false,
            \Voidhash\Generated\Core\Model\SetPaywallLocationInterfaceBody::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceActionDraft::class => false,
            \Voidhash\Generated\Core\Model\FlowInterfaceActionField::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceOutcomeDraft::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceOutputDraft::class => false,
            \Voidhash\Generated\Core\Model\LocationInterfaceInputDraft::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentSourceSubscription::class => false,
            \Voidhash\Generated\Core\Model\CancelPaymentSourceSubscriptionBody::class => false,
            \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody::class => false,
            \Voidhash\Generated\Core\Model\PaymentSourceCustomer::class => false,
            \Voidhash\Generated\Core\Model\PaymentSourceTransaction::class => false,
            \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody::class => false,
            \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderProductMappingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductMappingBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaymentProviderProductMappingBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderUnmappedProduct::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderCatalogEntryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderCatalogMapping::class => false,
            \Voidhash\Generated\Core\Model\PaymentSourceEndpointDescription::class => false,
            \Voidhash\Generated\Core\Model\PaymentSourceEndpointDescriptionSdk::class => false,
            \Voidhash\Generated\Core\Model\PaymentProviderJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaymentProviderBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaymentProviderBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\OrganizationSettingsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateOrganizationSettingsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PushNotificationDeliveryJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PushNotificationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AcceptedPushNotificationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePushNotificationBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CustomEventSettingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\IngestPolicyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PutFeatureFlagOverrideBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagServeJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagRuleJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagIdentityRef::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentOverrideJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingOverridesItem::class => false,
            \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem::class => false,
            \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe::class => false,
            \Voidhash\Generated\Core\Model\PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagVariantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem::class => false,
            \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagEvaluationsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagEvaluationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\FeatureFlagEvaluationContext::class => false,
            \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncodingVariantsItem::class => false,
            \Voidhash\Generated\Core\Model\ExperimentResultsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentVariantResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ExperimentFlagValue::class => false,
            \Voidhash\Generated\Core\Model\ExperimentPlacement::class => false,
            \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncodingVariantsItem::class => false,
            \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItem::class => false,
            \Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsEventJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SandboxActionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateSandboxActionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SandboxStateJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SandboxSubscriptionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SandboxPurchaseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SandboxGrantJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SandboxSettingsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateSandboxSettingsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallComponentUseJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ComponentConformanceResult::class => false,
            \Voidhash\Generated\Core\Model\ComponentConformanceCheck::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaywallComponentVersionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PaywallComponentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePaywallComponentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallComponentSourceVersionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentInstallJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePublishedComponentInstallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentInstallConsent::class => false,
            \Voidhash\Generated\Core\Model\CreatePublishedComponentInstallBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentInstallReviewJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentChange::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentFileJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePublishedComponentVersionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdatePublishedComponentBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePublishedComponentPromotionVersionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentThumbnail::class => false,
            \Voidhash\Generated\Core\Model\PublishedComponentBundleFile::class => false,
            \Voidhash\Generated\Core\Model\RegistryPublisherJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpsertRegistryPublisherBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\DevSessionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\DevSessionComponentJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\DevSessionBuild::class => false,
            \Voidhash\Generated\Core\Model\UpdateDevSessionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateDevSessionBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SessionJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SessionProjectJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SessionOrganizationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\SessionPersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateApiKeyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateApiKeyBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsGroupPersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsGroupJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsGroupTypeJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortDefinition::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortGroupCondition::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortCohortCondition::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortFirstTimeCondition::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortPerformedCondition::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortEventFilter::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortEventProperty::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortEventCount::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortTraitCondition::class => false,
            \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPersonJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateAnalyticsCohortBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortEvaluationJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\EvaluateAnalyticsCohortBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateAnalyticsCohortBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricPoint::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricQuery::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsGroupDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCohortDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPropertyDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsTraitDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPlanDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsBillingPeriodDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsProductDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsStoreDimension::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricFilter::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsCustomTimeRange::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPresetTimeRange::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsEventMetric::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsRevenueMetric::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMrrMetric::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsAlertJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\LiveUsersResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\LiveUsersOnSurface::class => false,
            \Voidhash\Generated\Core\Model\LiveUsersLocation::class => false,
            \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingWeb::class => false,
            \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingWebHostsItem::class => false,
            \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingAppsItem::class => false,
            \Voidhash\Generated\Core\Model\TrackingHealthResultJsonEncodingHandoff::class => false,
            \Voidhash\Generated\Core\Model\SdkVersionSeen::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionProjectionModel::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionProjectionPlan::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionCohort::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionCohortCellsItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionCohortProjection::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionCohortsReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingUnattributed::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingTotals::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingSelfReportedItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingFunnelItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingFunnelItemSurfacesItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingConvertedOn::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingConvertedOnJourneysItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverageClassesItem::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionPaymentSurface::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionSignupSurface::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionDay::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionGroup::class => false,
            \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\MetricActorsReportResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPointActor::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPointGroup::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsPointPerson::class => false,
            \Voidhash\Generated\Core\Model\MetricActorsReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\MetricsReportResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricResponseItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricResponseItemResolvedTimeRange::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsMetricResultSeriesItem::class => false,
            \Voidhash\Generated\Core\Model\MetricsReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ChartsReportResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartResponseItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartResponseItemResolvedTimeRange::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult::class => false,
            \Voidhash\Generated\Core\Model\Objects1::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartMarkersResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartMarkersResultMarkersItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartPointsResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartPointsResultPointsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartStatsResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartStatsResultStatsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartFlowResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartFlowResultNodesItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartFlowResultLinksItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartHeatmapResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResultBinsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartCurvesResultSeriesItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartCohortsResultCohortsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartFunnelResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartFunnelResultStepsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartTableResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartTableResultColumnsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartTableResultRowsItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartSeriesResult::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartSeriesResultSeriesItem::class => false,
            \Voidhash\Generated\Core\Model\ChartsReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartQuery::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartOptions::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsChartFilters::class => false,
            \Voidhash\Generated\Core\Model\InsightsReportResultJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItem::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsInsightResponseItemResolvedTimeRange::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsSummary::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsDataPoint::class => false,
            \Voidhash\Generated\Core\Model\InsightsReportBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsInsightQuery::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsFilterNot::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsFilterOr::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsFilterAnd::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsFilterPredicate::class => false,
            \Voidhash\Generated\Core\Model\AnalyticsBreakdown::class => false,
            \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AvailableAdAccountsJsonEncodingToken::class => false,
            \Voidhash\Generated\Core\Model\AvailableAdAccount::class => false,
            \Voidhash\Generated\Core\Model\QueryAvailableAdAccountsBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdAccountJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\AdAccountJsonEncodingSpendCap::class => false,
            \Voidhash\Generated\Core\Model\ConnectAdAccountBodyJsonEncoding::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAccountsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsAlertsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsCohortsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsCohortsCohortIdPeopleGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupTypesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAnalyticsGroupsGroupIdPeopleGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdApiKeysGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentDevSessionsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdRegistryComponentsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdRegistryComponentsRegistryComponentIdVersionsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentInstallsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentsComponentIdVersionsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdComponentUsesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdEventsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsPutResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdVariantsPutResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagsFeatureFlagIdOverridesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFeatureFlagOverridesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationsPushNotificationIdDeliveriesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdCatalogGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdUnmappedProductsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdProductsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdShowingsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdPinsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdRulesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsPaywallIdBuildsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallsPaywallIdLocationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPerksGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdEntitlementsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdPurchasesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPersonsPersonIdSubscriptionsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdProductsProductIdPerksGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdProjectsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPushNotificationConfigurationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdWebhooksGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdWebhooksWebhookIdDeliveriesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsCohortsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdVersionsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdRunsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAuditLogGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdMembersGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdInvitationsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdNoticesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdFilesGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAssetsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdParticipantsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdBoardsBoardIdTasksGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdCommentsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdSubscriptionsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdActivityGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdInboxGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1MeConnectedAppsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdTrackingDomainsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsCampaignsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAdGroupsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsAdsGetResponse200::class => false,
            \Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaymentProvidersPaymentProviderIdImportsGetResponse200::class => false,
            \Jane\Component\JsonSchemaRuntime\Reference::class => false,
        ];
    }
}