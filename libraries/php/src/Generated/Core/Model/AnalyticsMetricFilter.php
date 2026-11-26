<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricFilter
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
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @var AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension
     */
    protected $dimension;
    /**
     * `in` keeps the values, `not_in` everything else; `contains`, `not_contains`, `starts_with` and `ends_with` compare text with any of them, ignoring case; `regex` and `not_regex` match the first value as an RE2 regular expression; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @var string
     */
    protected $op;
    /**
     * Values as the result names them, such as a product id, `monthly`, or a group of `bins` such as `18–24`; `$unknown` is a person without the trait. At least one, except for `is_set` and `is_not_set`, which take none.
     *
     * @var list<string>
     */
    protected $values;
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @return AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension
     */
    public function getDimension()
    {
        return $this->dimension;
    }
    /**
     * What a metric is split or narrowed by; `kind` says which.
     *
     * @param AnalyticsStoreDimension|AnalyticsProductDimension|AnalyticsStoreProductDimension|AnalyticsCountryDimension|AnalyticsBillingPeriodDimension|AnalyticsPlanDimension|AnalyticsTraitDimension|AnalyticsPropertyDimension|AnalyticsCohortDimension|AnalyticsGroupDimension $dimension
     *
     * @return self
     */
    public function setDimension($dimension): self
    {
        $this->initialized['dimension'] = true;
        $this->dimension = $dimension;
        return $this;
    }
    /**
     * `in` keeps the values, `not_in` everything else; `contains`, `not_contains`, `starts_with` and `ends_with` compare text with any of them, ignoring case; `regex` and `not_regex` match the first value as an RE2 regular expression; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * `in` keeps the values, `not_in` everything else; `contains`, `not_contains`, `starts_with` and `ends_with` compare text with any of them, ignoring case; `regex` and `not_regex` match the first value as an RE2 regular expression; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @param string $op
     *
     * @return self
     */
    public function setOp(string $op): self
    {
        $this->initialized['op'] = true;
        $this->op = $op;
        return $this;
    }
    /**
     * Values as the result names them, such as a product id, `monthly`, or a group of `bins` such as `18–24`; `$unknown` is a person without the trait. At least one, except for `is_set` and `is_not_set`, which take none.
     *
     * @return list<string>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * Values as the result names them, such as a product id, `monthly`, or a group of `bins` such as `18–24`; `$unknown` is a person without the trait. At least one, except for `is_set` and `is_not_set`, which take none.
     *
     * @param list<string> $values
     *
     * @return self
     */
    public function setValues(array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}