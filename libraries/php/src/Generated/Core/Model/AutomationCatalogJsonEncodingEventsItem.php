<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncodingEventsItem
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
     * The event's name.
     *
     * @var string
     */
    protected $event;
    /**
     * The event's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * When Voidhash records the event.
     *
     * @var string
     */
    protected $description;
    /**
     * The event's name.
     *
     * @return string
     */
    public function getEvent(): string
    {
        return $this->event;
    }
    /**
     * The event's name.
     *
     * @param string $event
     *
     * @return self
     */
    public function setEvent(string $event): self
    {
        $this->initialized['event'] = true;
        $this->event = $event;
        return $this;
    }
    /**
     * The event's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The event's name, as Studio shows it.
     *
     * @param string $label
     *
     * @return self
     */
    public function setLabel(string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
    /**
     * When Voidhash records the event.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * When Voidhash records the event.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
}