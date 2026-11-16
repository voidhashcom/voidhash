<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartOptionsResult
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
     * Always `options`.
     *
     * @var string
     */
    protected $shape;
    /**
     * Up to 200 platforms seen in the last 90 days, most frequent first, for `filters.platforms`.
     *
     * @var list<Objects1>
     */
    protected $platforms;
    /**
     * Up to 200 countries seen in the last 90 days, most frequent first, for `filters.countries`.
     *
     * @var list<Objects1>
     */
    protected $countries;
    /**
     * Up to 200 app versions seen in the last 90 days, most frequent first, for `filters.appVersions`.
     *
     * @var list<Objects1>
     */
    protected $appVersions;
    /**
     * The project's products, for `filters.productIds`.
     *
     * @var list<Objects1>
     */
    protected $products;
    /**
     * The project's stores and payment sources, for `filters.stores`.
     *
     * @var list<Objects1>
     */
    protected $stores;
    /**
     * The project's paywall locations that are not archived, for `options.placementId`.
     *
     * @var list<Objects1>
     */
    protected $placements;
    /**
     * The project's experiments that are not archived, for `options.experimentId`.
     *
     * @var list<Objects1>
     */
    protected $experiments;
    /**
     * Up to 200 event names seen in the last 90 days, most frequent first, for `options.eventName`.
     *
     * @var list<Objects1>
     */
    protected $events;
    /**
     * Up to 200 trait keys people of the project have, the most held first, to split or narrow metrics by.
     *
     * @var list<Objects1>
     */
    protected $traits;
    /**
     * Up to 200 property keys of the event named by `options.eventName`, read from its latest 10,000 events of the last 90 days, the most used first; empty without `options.eventName`.
     *
     * @var list<Objects1>
     */
    protected $properties;
    /**
     * Always `options`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `options`.
     *
     * @param string $shape
     *
     * @return self
     */
    public function setShape(string $shape): self
    {
        $this->initialized['shape'] = true;
        $this->shape = $shape;
        return $this;
    }
    /**
     * Up to 200 platforms seen in the last 90 days, most frequent first, for `filters.platforms`.
     *
     * @return list<Objects1>
     */
    public function getPlatforms(): array
    {
        return $this->platforms;
    }
    /**
     * Up to 200 platforms seen in the last 90 days, most frequent first, for `filters.platforms`.
     *
     * @param list<Objects1> $platforms
     *
     * @return self
     */
    public function setPlatforms(array $platforms): self
    {
        $this->initialized['platforms'] = true;
        $this->platforms = $platforms;
        return $this;
    }
    /**
     * Up to 200 countries seen in the last 90 days, most frequent first, for `filters.countries`.
     *
     * @return list<Objects1>
     */
    public function getCountries(): array
    {
        return $this->countries;
    }
    /**
     * Up to 200 countries seen in the last 90 days, most frequent first, for `filters.countries`.
     *
     * @param list<Objects1> $countries
     *
     * @return self
     */
    public function setCountries(array $countries): self
    {
        $this->initialized['countries'] = true;
        $this->countries = $countries;
        return $this;
    }
    /**
     * Up to 200 app versions seen in the last 90 days, most frequent first, for `filters.appVersions`.
     *
     * @return list<Objects1>
     */
    public function getAppVersions(): array
    {
        return $this->appVersions;
    }
    /**
     * Up to 200 app versions seen in the last 90 days, most frequent first, for `filters.appVersions`.
     *
     * @param list<Objects1> $appVersions
     *
     * @return self
     */
    public function setAppVersions(array $appVersions): self
    {
        $this->initialized['appVersions'] = true;
        $this->appVersions = $appVersions;
        return $this;
    }
    /**
     * The project's products, for `filters.productIds`.
     *
     * @return list<Objects1>
     */
    public function getProducts(): array
    {
        return $this->products;
    }
    /**
     * The project's products, for `filters.productIds`.
     *
     * @param list<Objects1> $products
     *
     * @return self
     */
    public function setProducts(array $products): self
    {
        $this->initialized['products'] = true;
        $this->products = $products;
        return $this;
    }
    /**
     * The project's stores and payment sources, for `filters.stores`.
     *
     * @return list<Objects1>
     */
    public function getStores(): array
    {
        return $this->stores;
    }
    /**
     * The project's stores and payment sources, for `filters.stores`.
     *
     * @param list<Objects1> $stores
     *
     * @return self
     */
    public function setStores(array $stores): self
    {
        $this->initialized['stores'] = true;
        $this->stores = $stores;
        return $this;
    }
    /**
     * The project's paywall locations that are not archived, for `options.placementId`.
     *
     * @return list<Objects1>
     */
    public function getPlacements(): array
    {
        return $this->placements;
    }
    /**
     * The project's paywall locations that are not archived, for `options.placementId`.
     *
     * @param list<Objects1> $placements
     *
     * @return self
     */
    public function setPlacements(array $placements): self
    {
        $this->initialized['placements'] = true;
        $this->placements = $placements;
        return $this;
    }
    /**
     * The project's experiments that are not archived, for `options.experimentId`.
     *
     * @return list<Objects1>
     */
    public function getExperiments(): array
    {
        return $this->experiments;
    }
    /**
     * The project's experiments that are not archived, for `options.experimentId`.
     *
     * @param list<Objects1> $experiments
     *
     * @return self
     */
    public function setExperiments(array $experiments): self
    {
        $this->initialized['experiments'] = true;
        $this->experiments = $experiments;
        return $this;
    }
    /**
     * Up to 200 event names seen in the last 90 days, most frequent first, for `options.eventName`.
     *
     * @return list<Objects1>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * Up to 200 event names seen in the last 90 days, most frequent first, for `options.eventName`.
     *
     * @param list<Objects1> $events
     *
     * @return self
     */
    public function setEvents(array $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * Up to 200 trait keys people of the project have, the most held first, to split or narrow metrics by.
     *
     * @return list<Objects1>
     */
    public function getTraits(): array
    {
        return $this->traits;
    }
    /**
     * Up to 200 trait keys people of the project have, the most held first, to split or narrow metrics by.
     *
     * @param list<Objects1> $traits
     *
     * @return self
     */
    public function setTraits(array $traits): self
    {
        $this->initialized['traits'] = true;
        $this->traits = $traits;
        return $this;
    }
    /**
     * Up to 200 property keys of the event named by `options.eventName`, read from its latest 10,000 events of the last 90 days, the most used first; empty without `options.eventName`.
     *
     * @return list<Objects1>
     */
    public function getProperties(): array
    {
        return $this->properties;
    }
    /**
     * Up to 200 property keys of the event named by `options.eventName`, read from its latest 10,000 events of the last 90 days, the most used first; empty without `options.eventName`.
     *
     * @param list<Objects1> $properties
     *
     * @return self
     */
    public function setProperties(array $properties): self
    {
        $this->initialized['properties'] = true;
        $this->properties = $properties;
        return $this;
    }
}