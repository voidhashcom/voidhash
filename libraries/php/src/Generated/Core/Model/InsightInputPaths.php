<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputPaths
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
     * The event paths start from.
     *
     * @var string
     */
    protected $start;
    /**
     * The event paths end at.
     *
     * @var string
     */
    protected $end;
    /**
     * Events left out of paths, at most 50.
     *
     * @var list<string>
     */
    protected $exclude;
    /**
     * How many steps each path is followed for, from 2 to 20; 5 unless given.
     *
     * @var int
     */
    protected $depth;
    /**
     * Paths of event names (`event_name`) or of the screens the app reported (`screen_name`).
     *
     * @var string
     */
    protected $item;
    /**
     * Whether an event repeated in a row counts once; true unless given.
     *
     * @var bool
     */
    protected $collapseRepeated;
    /**
     * How many of the most travelled links are drawn, from 1 to 200; 50 unless given.
     *
     * @var int
     */
    protected $edgeLimit;
    /**
     * Links fewer sessions took than this are left out.
     *
     * @var int
     */
    protected $minEdgeCount;
    /**
     * Links more sessions took than this are left out.
     *
     * @var int
     */
    protected $maxEdgeCount;
    /**
     * The event paths start from.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The event paths start from.
     *
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * The event paths end at.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The event paths end at.
     *
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
    /**
     * Events left out of paths, at most 50.
     *
     * @return list<string>
     */
    public function getExclude(): array
    {
        return $this->exclude;
    }
    /**
     * Events left out of paths, at most 50.
     *
     * @param list<string> $exclude
     *
     * @return self
     */
    public function setExclude(array $exclude): self
    {
        $this->initialized['exclude'] = true;
        $this->exclude = $exclude;
        return $this;
    }
    /**
     * How many steps each path is followed for, from 2 to 20; 5 unless given.
     *
     * @return int
     */
    public function getDepth(): int
    {
        return $this->depth;
    }
    /**
     * How many steps each path is followed for, from 2 to 20; 5 unless given.
     *
     * @param int $depth
     *
     * @return self
     */
    public function setDepth(int $depth): self
    {
        $this->initialized['depth'] = true;
        $this->depth = $depth;
        return $this;
    }
    /**
     * Paths of event names (`event_name`) or of the screens the app reported (`screen_name`).
     *
     * @return string
     */
    public function getItem(): string
    {
        return $this->item;
    }
    /**
     * Paths of event names (`event_name`) or of the screens the app reported (`screen_name`).
     *
     * @param string $item
     *
     * @return self
     */
    public function setItem(string $item): self
    {
        $this->initialized['item'] = true;
        $this->item = $item;
        return $this;
    }
    /**
     * Whether an event repeated in a row counts once; true unless given.
     *
     * @return bool
     */
    public function getCollapseRepeated(): bool
    {
        return $this->collapseRepeated;
    }
    /**
     * Whether an event repeated in a row counts once; true unless given.
     *
     * @param bool $collapseRepeated
     *
     * @return self
     */
    public function setCollapseRepeated(bool $collapseRepeated): self
    {
        $this->initialized['collapseRepeated'] = true;
        $this->collapseRepeated = $collapseRepeated;
        return $this;
    }
    /**
     * How many of the most travelled links are drawn, from 1 to 200; 50 unless given.
     *
     * @return int
     */
    public function getEdgeLimit(): int
    {
        return $this->edgeLimit;
    }
    /**
     * How many of the most travelled links are drawn, from 1 to 200; 50 unless given.
     *
     * @param int $edgeLimit
     *
     * @return self
     */
    public function setEdgeLimit(int $edgeLimit): self
    {
        $this->initialized['edgeLimit'] = true;
        $this->edgeLimit = $edgeLimit;
        return $this;
    }
    /**
     * Links fewer sessions took than this are left out.
     *
     * @return int
     */
    public function getMinEdgeCount(): int
    {
        return $this->minEdgeCount;
    }
    /**
     * Links fewer sessions took than this are left out.
     *
     * @param int $minEdgeCount
     *
     * @return self
     */
    public function setMinEdgeCount(int $minEdgeCount): self
    {
        $this->initialized['minEdgeCount'] = true;
        $this->minEdgeCount = $minEdgeCount;
        return $this;
    }
    /**
     * Links more sessions took than this are left out.
     *
     * @return int
     */
    public function getMaxEdgeCount(): int
    {
        return $this->maxEdgeCount;
    }
    /**
     * Links more sessions took than this are left out.
     *
     * @param int $maxEdgeCount
     *
     * @return self
     */
    public function setMaxEdgeCount(int $maxEdgeCount): self
    {
        $this->initialized['maxEdgeCount'] = true;
        $this->maxEdgeCount = $maxEdgeCount;
        return $this;
    }
}