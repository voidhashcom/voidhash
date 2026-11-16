<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartFlowResult
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
     * Always `flow`.
     *
     * @var string
     */
    protected $shape;
    /**
     * The nodes, such as screens or plans.
     *
     * @var list<AnalyticsChartFlowResultNodesItem>
     */
    protected $nodes;
    /**
     * The movements between nodes.
     *
     * @var list<AnalyticsChartFlowResultLinksItem>
     */
    protected $links;
    /**
     * Always `flow`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `flow`.
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
     * The nodes, such as screens or plans.
     *
     * @return list<AnalyticsChartFlowResultNodesItem>
     */
    public function getNodes(): array
    {
        return $this->nodes;
    }
    /**
     * The nodes, such as screens or plans.
     *
     * @param list<AnalyticsChartFlowResultNodesItem> $nodes
     *
     * @return self
     */
    public function setNodes(array $nodes): self
    {
        $this->initialized['nodes'] = true;
        $this->nodes = $nodes;
        return $this;
    }
    /**
     * The movements between nodes.
     *
     * @return list<AnalyticsChartFlowResultLinksItem>
     */
    public function getLinks(): array
    {
        return $this->links;
    }
    /**
     * The movements between nodes.
     *
     * @param list<AnalyticsChartFlowResultLinksItem> $links
     *
     * @return self
     */
    public function setLinks(array $links): self
    {
        $this->initialized['links'] = true;
        $this->links = $links;
        return $this;
    }
}