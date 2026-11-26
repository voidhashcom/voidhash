<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartExcludedFilters
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
     * No events from these app versions.
     *
     * @var list<string>|null
     */
    protected $appVersions;
    /**
     * Nobody in any of these cohorts, by cohort id.
     *
     * @var list<string>|null
     */
    protected $cohortIds;
    /**
     * None of these countries, as ISO 3166 alpha-2 codes.
     *
     * @var list<string>|null
     */
    protected $countries;
    /**
     * No paywall presentations whose package came from these sources.
     *
     * @var list<string>|null
     */
    protected $packageSources;
    /**
     * None of these platforms.
     *
     * @var list<string>|null
     */
    protected $platforms;
    /**
     * No purchases of these products, by id (`prod_...`).
     *
     * @var list<string>|null
     */
    protected $productIds;
    /**
     * No purchases from these stores, such as `stripe`.
     *
     * @var list<string>|null
     */
    protected $stores;
    /**
     * No events from these app versions.
     *
     * @return list<string>|null
     */
    public function getAppVersions(): ?array
    {
        return $this->appVersions;
    }
    /**
     * No events from these app versions.
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
     * Nobody in any of these cohorts, by cohort id.
     *
     * @return list<string>|null
     */
    public function getCohortIds(): ?array
    {
        return $this->cohortIds;
    }
    /**
     * Nobody in any of these cohorts, by cohort id.
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
     * None of these countries, as ISO 3166 alpha-2 codes.
     *
     * @return list<string>|null
     */
    public function getCountries(): ?array
    {
        return $this->countries;
    }
    /**
     * None of these countries, as ISO 3166 alpha-2 codes.
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
     * No paywall presentations whose package came from these sources.
     *
     * @return list<string>|null
     */
    public function getPackageSources(): ?array
    {
        return $this->packageSources;
    }
    /**
     * No paywall presentations whose package came from these sources.
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
     * None of these platforms.
     *
     * @return list<string>|null
     */
    public function getPlatforms(): ?array
    {
        return $this->platforms;
    }
    /**
     * None of these platforms.
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
     * No purchases of these products, by id (`prod_...`).
     *
     * @return list<string>|null
     */
    public function getProductIds(): ?array
    {
        return $this->productIds;
    }
    /**
     * No purchases of these products, by id (`prod_...`).
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
     * No purchases from these stores, such as `stripe`.
     *
     * @return list<string>|null
     */
    public function getStores(): ?array
    {
        return $this->stores;
    }
    /**
     * No purchases from these stores, such as `stripe`.
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
}