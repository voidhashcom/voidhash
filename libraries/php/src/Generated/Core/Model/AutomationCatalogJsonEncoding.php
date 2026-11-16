<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncoding
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
     * Every trigger type: what can start an automation.
     *
     * @var list<AutomationCatalogJsonEncodingTriggersItem>
     */
    protected $triggers;
    /**
     * Every step type.
     *
     * @var list<AutomationCatalogJsonEncodingStepsItem>
     */
    protected $steps;
    /**
     * Events Voidhash records itself, such as purchase events, which a trigger or a wait can name besides an app's own.
     *
     * @var list<AutomationCatalogJsonEncodingEventsItem>
     */
    protected $events;
    /**
     * What rules and templates can read.
     *
     * @var list<AutomationCatalogJsonEncodingContextFieldsItem>
     */
    protected $contextFields;
    /**
     * Every trigger type: what can start an automation.
     *
     * @return list<AutomationCatalogJsonEncodingTriggersItem>
     */
    public function getTriggers(): array
    {
        return $this->triggers;
    }
    /**
     * Every trigger type: what can start an automation.
     *
     * @param list<AutomationCatalogJsonEncodingTriggersItem> $triggers
     *
     * @return self
     */
    public function setTriggers(array $triggers): self
    {
        $this->initialized['triggers'] = true;
        $this->triggers = $triggers;
        return $this;
    }
    /**
     * Every step type.
     *
     * @return list<AutomationCatalogJsonEncodingStepsItem>
     */
    public function getSteps(): array
    {
        return $this->steps;
    }
    /**
     * Every step type.
     *
     * @param list<AutomationCatalogJsonEncodingStepsItem> $steps
     *
     * @return self
     */
    public function setSteps(array $steps): self
    {
        $this->initialized['steps'] = true;
        $this->steps = $steps;
        return $this;
    }
    /**
     * Events Voidhash records itself, such as purchase events, which a trigger or a wait can name besides an app's own.
     *
     * @return list<AutomationCatalogJsonEncodingEventsItem>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * Events Voidhash records itself, such as purchase events, which a trigger or a wait can name besides an app's own.
     *
     * @param list<AutomationCatalogJsonEncodingEventsItem> $events
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
     * What rules and templates can read.
     *
     * @return list<AutomationCatalogJsonEncodingContextFieldsItem>
     */
    public function getContextFields(): array
    {
        return $this->contextFields;
    }
    /**
     * What rules and templates can read.
     *
     * @param list<AutomationCatalogJsonEncodingContextFieldsItem> $contextFields
     *
     * @return self
     */
    public function setContextFields(array $contextFields): self
    {
        $this->initialized['contextFields'] = true;
        $this->contextFields = $contextFields;
        return $this;
    }
}