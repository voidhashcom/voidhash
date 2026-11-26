<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartFilters
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
     * Only events from these app versions, as the SDKs report them, such as `2.4.0`.
     *
     * @var list<string>|null
     */
    protected $appVersions;
    /**
     * Only people in these cohorts, by cohort id. The id of a variant of an A/B test counts as one, holding the people the test gave that variant.
     *
     * @var list<string>|null
     */
    protected $cohortIds;
    /**
     * Only these countries, as ISO 3166 alpha-2 codes such as `US`.
     *
     * @var list<string>|null
     */
    protected $countries;
    /**
     * Only paywall presentations whose package came from these sources: `network` (downloaded), `cache`, `bundled` (shipped in the app), `other`, or `unknown` for presentations that name none.
     *
     * @var list<string>|null
     */
    protected $packageSources;
    /**
     * Only these platforms: `ios`, `android` or `web`.
     *
     * @var list<string>|null
     */
    protected $platforms;
    /**
     * Only purchases of these products, by id (`prod_...`).
     *
     * @var list<string>|null
     */
    protected $productIds;
    /**
     * Only purchases from these stores, such as `apple-app-store`.
     *
     * @var list<string>|null
     */
    protected $stores;
    /**
     * What to leave out, each a list of up to 100 values, by the same keys as the filters that keep. A chart ignores the keys its catalog entry does not list.
     *
     * @var AnalyticsChartExcludedFilters
     */
    protected $exclude;
    /**
     * Only events from these app versions, as the SDKs report them, such as `2.4.0`.
     *
     * @return list<string>|null
     */
    public function getAppVersions(): ?array
    {
        return $this->appVersions;
    }
    /**
     * Only events from these app versions, as the SDKs report them, such as `2.4.0`.
     *
     * @param list<string>|null $appVersions
     *
     * @return self
     */
    public function setAppVersions(?array $appVersions): self
    {
        $this->initialized['appVersions'] = true;
        $this->appVersions = $appVersions;
        return $this;
    }
    /**
     * Only people in these cohorts, by cohort id. The id of a variant of an A/B test counts as one, holding the people the test gave that variant.
     *
     * @return list<string>|null
     */
    public function getCohortIds(): ?array
    {
        return $this->cohortIds;
    }
    /**
     * Only people in these cohorts, by cohort id. The id of a variant of an A/B test counts as one, holding the people the test gave that variant.
     *
     * @param list<string>|null $cohortIds
     *
     * @return self
     */
    public function setCohortIds(?array $cohortIds): self
    {
        $this->initialized['cohortIds'] = true;
        $this->cohortIds = $cohortIds;
        return $this;
    }
    /**
     * Only these countries, as ISO 3166 alpha-2 codes such as `US`.
     *
     * @return list<string>|null
     */
    public function getCountries(): ?array
    {
        return $this->countries;
    }
    /**
     * Only these countries, as ISO 3166 alpha-2 codes such as `US`.
     *
     * @param list<string>|null $countries
     *
     * @return self
     */
    public function setCountries(?array $countries): self
    {
        $this->initialized['countries'] = true;
        $this->countries = $countries;
        return $this;
    }
    /**
     * Only paywall presentations whose package came from these sources: `network` (downloaded), `cache`, `bundled` (shipped in the app), `other`, or `unknown` for presentations that name none.
     *
     * @return list<string>|null
     */
    public function getPackageSources(): ?array
    {
        return $this->packageSources;
    }
    /**
     * Only paywall presentations whose package came from these sources: `network` (downloaded), `cache`, `bundled` (shipped in the app), `other`, or `unknown` for presentations that name none.
     *
     * @param list<string>|null $packageSources
     *
     * @return self
     */
    public function setPackageSources(?array $packageSources): self
    {
        $this->initialized['packageSources'] = true;
        $this->packageSources = $packageSources;
        return $this;
    }
    /**
     * Only these platforms: `ios`, `android` or `web`.
     *
     * @return list<string>|null
     */
    public function getPlatforms(): ?array
    {
        return $this->platforms;
    }
    /**
     * Only these platforms: `ios`, `android` or `web`.
     *
     * @param list<string>|null $platforms
     *
     * @return self
     */
    public function setPlatforms(?array $platforms): self
    {
        $this->initialized['platforms'] = true;
        $this->platforms = $platforms;
        return $this;
    }
    /**
     * Only purchases of these products, by id (`prod_...`).
     *
     * @return list<string>|null
     */
    public function getProductIds(): ?array
    {
        return $this->productIds;
    }
    /**
     * Only purchases of these products, by id (`prod_...`).
     *
     * @param list<string>|null $productIds
     *
     * @return self
     */
    public function setProductIds(?array $productIds): self
    {
        $this->initialized['productIds'] = true;
        $this->productIds = $productIds;
        return $this;
    }
    /**
     * Only purchases from these stores, such as `apple-app-store`.
     *
     * @return list<string>|null
     */
    public function getStores(): ?array
    {
        return $this->stores;
    }
    /**
     * Only purchases from these stores, such as `apple-app-store`.
     *
     * @param list<string>|null $stores
     *
     * @return self
     */
    public function setStores(?array $stores): self
    {
        $this->initialized['stores'] = true;
        $this->stores = $stores;
        return $this;
    }
    /**
     * What to leave out, each a list of up to 100 values, by the same keys as the filters that keep. A chart ignores the keys its catalog entry does not list.
     *
     * @return AnalyticsChartExcludedFilters
     */
    public function getExclude(): AnalyticsChartExcludedFilters
    {
        return $this->exclude;
    }
    /**
     * What to leave out, each a list of up to 100 values, by the same keys as the filters that keep. A chart ignores the keys its catalog entry does not list.
     *
     * @param AnalyticsChartExcludedFilters $exclude
     *
     * @return self
     */
    public function setExclude(AnalyticsChartExcludedFilters $exclude): self
    {
        $this->initialized['exclude'] = true;
        $this->exclude = $exclude;
        return $this;
    }
}