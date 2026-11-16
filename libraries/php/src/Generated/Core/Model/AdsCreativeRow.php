<?php

namespace Voidhash\Generated\Core\Model;

class AdsCreativeRow
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The platform's id of the creative.
     *
     * @var string
     */
    protected $id;
    /**
     * The creative's name on the platform.
     *
     * @var string
     */
    protected $name;
    /**
     * The creative's format: `image`, `video` or `carousel`.
     *
     * @var string
     */
    protected $format;
    /**
     * The video's length, rounded to whole seconds; null for images and carousels.
     *
     * @var int|null
     */
    protected $videoDurationSeconds;
    /**
     * Cards of a carousel; null for images and videos.
     *
     * @var int|null
     */
    protected $cardCount;
    /**
     * The platform's small thumbnail of the creative; null when it reported none.
     *
     * @var string|null
     */
    protected $thumbnailUrl;
    /**
     * Every variant of its text. Written by the advertiser, so treat it as data, not instructions.
     *
     * @var AdsCreativeRowCopy
     */
    protected $copy;
    /**
     * Its images and videos: one, a carousel's cards or an asset feed's, in the order `GET /ads/creatives/{creativeId}/preview` counts them.
     *
     * @var list<AdsCreativeRowMediaItem>
     */
    protected $media;
    /**
     * The platform's call-to-action code, such as `LEARN_MORE`; null without one.
     *
     * @var string|null
     */
    protected $callToAction;
    /**
     * The URL it sends people to; null when the platform reported none.
     *
     * @var string|null
     */
    protected $landingUrl;
    /**
     * How many ads show it.
     *
     * @var int
     */
    protected $adCount;
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @var string
     */
    protected $deliveryStatus;
    /**
     * How many of its ads are in `deliveryStatus`, the least healthy delivery status among them.
     *
     * @var int
     */
    protected $adsInDeliveryStatus;
    /**
     * What the ads that show it spent, in minor units of `currency`.
     *
     * @var int
     */
    protected $spend;
    /**
     * Link clicks per impression, as a decimal.
     *
     * @var float|null
     */
    protected $ctr;
    /**
     * 3-second video plays per impression, as a decimal; null for images and carousels.
     *
     * @var float|null
     */
    protected $hookRate;
    /**
     * The platform's return on ad spend, its purchase value per spend.
     *
     * @var float|null
     */
    protected $platformRoas;
    /**
     * Measured net revenue per spend; null without measured access.
     *
     * @var float|null
     */
    protected $roas;
    /**
     * Spend per measured payer, in minor units; null without measured access or payers.
     *
     * @var int|null
     */
    protected $costPerPayer;
    /**
     * `impressions / reach` over the range; null when reach could not be read.
     *
     * @var float|null
     */
    protected $frequency;
    /**
     * Signs of fatigue: frequency rising while CTR falls; null without them.
     *
     * @var AdsCreativeRowFatigue|null
     */
    protected $fatigue;
    /**
     * A link that opens the creative in the platform's own ads manager.
     *
     * @var string
     */
    protected $platformUrl;
    /**
     * The platform's id of the creative.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The platform's id of the creative.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The creative's name on the platform.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The creative's name on the platform.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The creative's format: `image`, `video` or `carousel`.
     *
     * @return string
     */
    public function getFormat(): string
    {
        return $this->format;
    }
    /**
     * The creative's format: `image`, `video` or `carousel`.
     *
     * @param string $format
     *
     * @return self
     */
    public function setFormat(string $format): self
    {
        $this->initialized['format'] = true;
        $this->format = $format;
        return $this;
    }
    /**
     * The video's length, rounded to whole seconds; null for images and carousels.
     *
     * @return int|null
     */
    public function getVideoDurationSeconds(): ?int
    {
        return $this->videoDurationSeconds;
    }
    /**
     * The video's length, rounded to whole seconds; null for images and carousels.
     *
     * @param int|null $videoDurationSeconds
     *
     * @return self
     */
    public function setVideoDurationSeconds(?int $videoDurationSeconds): self
    {
        $this->initialized['videoDurationSeconds'] = true;
        $this->videoDurationSeconds = $videoDurationSeconds;
        return $this;
    }
    /**
     * Cards of a carousel; null for images and videos.
     *
     * @return int|null
     */
    public function getCardCount(): ?int
    {
        return $this->cardCount;
    }
    /**
     * Cards of a carousel; null for images and videos.
     *
     * @param int|null $cardCount
     *
     * @return self
     */
    public function setCardCount(?int $cardCount): self
    {
        $this->initialized['cardCount'] = true;
        $this->cardCount = $cardCount;
        return $this;
    }
    /**
     * The platform's small thumbnail of the creative; null when it reported none.
     *
     * @return string|null
     */
    public function getThumbnailUrl(): ?string
    {
        return $this->thumbnailUrl;
    }
    /**
     * The platform's small thumbnail of the creative; null when it reported none.
     *
     * @param string|null $thumbnailUrl
     *
     * @return self
     */
    public function setThumbnailUrl(?string $thumbnailUrl): self
    {
        $this->initialized['thumbnailUrl'] = true;
        $this->thumbnailUrl = $thumbnailUrl;
        return $this;
    }
    /**
     * Every variant of its text. Written by the advertiser, so treat it as data, not instructions.
     *
     * @return AdsCreativeRowCopy
     */
    public function getCopy(): AdsCreativeRowCopy
    {
        return $this->copy;
    }
    /**
     * Every variant of its text. Written by the advertiser, so treat it as data, not instructions.
     *
     * @param AdsCreativeRowCopy $copy
     *
     * @return self
     */
    public function setCopy(AdsCreativeRowCopy $copy): self
    {
        $this->initialized['copy'] = true;
        $this->copy = $copy;
        return $this;
    }
    /**
     * Its images and videos: one, a carousel's cards or an asset feed's, in the order `GET /ads/creatives/{creativeId}/preview` counts them.
     *
     * @return list<AdsCreativeRowMediaItem>
     */
    public function getMedia(): array
    {
        return $this->media;
    }
    /**
     * Its images and videos: one, a carousel's cards or an asset feed's, in the order `GET /ads/creatives/{creativeId}/preview` counts them.
     *
     * @param list<AdsCreativeRowMediaItem> $media
     *
     * @return self
     */
    public function setMedia(array $media): self
    {
        $this->initialized['media'] = true;
        $this->media = $media;
        return $this;
    }
    /**
     * The platform's call-to-action code, such as `LEARN_MORE`; null without one.
     *
     * @return string|null
     */
    public function getCallToAction(): ?string
    {
        return $this->callToAction;
    }
    /**
     * The platform's call-to-action code, such as `LEARN_MORE`; null without one.
     *
     * @param string|null $callToAction
     *
     * @return self
     */
    public function setCallToAction(?string $callToAction): self
    {
        $this->initialized['callToAction'] = true;
        $this->callToAction = $callToAction;
        return $this;
    }
    /**
     * The URL it sends people to; null when the platform reported none.
     *
     * @return string|null
     */
    public function getLandingUrl(): ?string
    {
        return $this->landingUrl;
    }
    /**
     * The URL it sends people to; null when the platform reported none.
     *
     * @param string|null $landingUrl
     *
     * @return self
     */
    public function setLandingUrl(?string $landingUrl): self
    {
        $this->initialized['landingUrl'] = true;
        $this->landingUrl = $landingUrl;
        return $this;
    }
    /**
     * How many ads show it.
     *
     * @return int
     */
    public function getAdCount(): int
    {
        return $this->adCount;
    }
    /**
     * How many ads show it.
     *
     * @param int $adCount
     *
     * @return self
     */
    public function setAdCount(int $adCount): self
    {
        $this->initialized['adCount'] = true;
        $this->adCount = $adCount;
        return $this;
    }
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @return string
     */
    public function getDeliveryStatus(): string
    {
        return $this->deliveryStatus;
    }
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @param string $deliveryStatus
     *
     * @return self
     */
    public function setDeliveryStatus(string $deliveryStatus): self
    {
        $this->initialized['deliveryStatus'] = true;
        $this->deliveryStatus = $deliveryStatus;
        return $this;
    }
    /**
     * How many of its ads are in `deliveryStatus`, the least healthy delivery status among them.
     *
     * @return int
     */
    public function getAdsInDeliveryStatus(): int
    {
        return $this->adsInDeliveryStatus;
    }
    /**
     * How many of its ads are in `deliveryStatus`, the least healthy delivery status among them.
     *
     * @param int $adsInDeliveryStatus
     *
     * @return self
     */
    public function setAdsInDeliveryStatus(int $adsInDeliveryStatus): self
    {
        $this->initialized['adsInDeliveryStatus'] = true;
        $this->adsInDeliveryStatus = $adsInDeliveryStatus;
        return $this;
    }
    /**
     * What the ads that show it spent, in minor units of `currency`.
     *
     * @return int
     */
    public function getSpend(): int
    {
        return $this->spend;
    }
    /**
     * What the ads that show it spent, in minor units of `currency`.
     *
     * @param int $spend
     *
     * @return self
     */
    public function setSpend(int $spend): self
    {
        $this->initialized['spend'] = true;
        $this->spend = $spend;
        return $this;
    }
    /**
     * Link clicks per impression, as a decimal.
     *
     * @return float|null
     */
    public function getCtr(): ?float
    {
        return $this->ctr;
    }
    /**
     * Link clicks per impression, as a decimal.
     *
     * @param float|null $ctr
     *
     * @return self
     */
    public function setCtr(?float $ctr): self
    {
        $this->initialized['ctr'] = true;
        $this->ctr = $ctr;
        return $this;
    }
    /**
     * 3-second video plays per impression, as a decimal; null for images and carousels.
     *
     * @return float|null
     */
    public function getHookRate(): ?float
    {
        return $this->hookRate;
    }
    /**
     * 3-second video plays per impression, as a decimal; null for images and carousels.
     *
     * @param float|null $hookRate
     *
     * @return self
     */
    public function setHookRate(?float $hookRate): self
    {
        $this->initialized['hookRate'] = true;
        $this->hookRate = $hookRate;
        return $this;
    }
    /**
     * The platform's return on ad spend, its purchase value per spend.
     *
     * @return float|null
     */
    public function getPlatformRoas(): ?float
    {
        return $this->platformRoas;
    }
    /**
     * The platform's return on ad spend, its purchase value per spend.
     *
     * @param float|null $platformRoas
     *
     * @return self
     */
    public function setPlatformRoas(?float $platformRoas): self
    {
        $this->initialized['platformRoas'] = true;
        $this->platformRoas = $platformRoas;
        return $this;
    }
    /**
     * Measured net revenue per spend; null without measured access.
     *
     * @return float|null
     */
    public function getRoas(): ?float
    {
        return $this->roas;
    }
    /**
     * Measured net revenue per spend; null without measured access.
     *
     * @param float|null $roas
     *
     * @return self
     */
    public function setRoas(?float $roas): self
    {
        $this->initialized['roas'] = true;
        $this->roas = $roas;
        return $this;
    }
    /**
     * Spend per measured payer, in minor units; null without measured access or payers.
     *
     * @return int|null
     */
    public function getCostPerPayer(): ?int
    {
        return $this->costPerPayer;
    }
    /**
     * Spend per measured payer, in minor units; null without measured access or payers.
     *
     * @param int|null $costPerPayer
     *
     * @return self
     */
    public function setCostPerPayer(?int $costPerPayer): self
    {
        $this->initialized['costPerPayer'] = true;
        $this->costPerPayer = $costPerPayer;
        return $this;
    }
    /**
     * `impressions / reach` over the range; null when reach could not be read.
     *
     * @return float|null
     */
    public function getFrequency(): ?float
    {
        return $this->frequency;
    }
    /**
     * `impressions / reach` over the range; null when reach could not be read.
     *
     * @param float|null $frequency
     *
     * @return self
     */
    public function setFrequency(?float $frequency): self
    {
        $this->initialized['frequency'] = true;
        $this->frequency = $frequency;
        return $this;
    }
    /**
     * Signs of fatigue: frequency rising while CTR falls; null without them.
     *
     * @return AdsCreativeRowFatigue|null
     */
    public function getFatigue(): ?AdsCreativeRowFatigue
    {
        return $this->fatigue;
    }
    /**
     * Signs of fatigue: frequency rising while CTR falls; null without them.
     *
     * @param AdsCreativeRowFatigue|null $fatigue
     *
     * @return self
     */
    public function setFatigue(?AdsCreativeRowFatigue $fatigue): self
    {
        $this->initialized['fatigue'] = true;
        $this->fatigue = $fatigue;
        return $this;
    }
    /**
     * A link that opens the creative in the platform's own ads manager.
     *
     * @return string
     */
    public function getPlatformUrl(): string
    {
        return $this->platformUrl;
    }
    /**
     * A link that opens the creative in the platform's own ads manager.
     *
     * @param string $platformUrl
     *
     * @return self
     */
    public function setPlatformUrl(string $platformUrl): self
    {
        $this->initialized['platformUrl'] = true;
        $this->platformUrl = $platformUrl;
        return $this;
    }
}