<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingSelfReportedItem
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
     * The answer, lowercased and trimmed.
     *
     * @var string
     */
    protected $answer;
    /**
     * Unattributed people who gave it, at least 2.
     *
     * @var int
     */
    protected $people;
    /**
     * Their net revenue, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * The answer, lowercased and trimmed.
     *
     * @return string
     */
    public function getAnswer(): string
    {
        return $this->answer;
    }
    /**
     * The answer, lowercased and trimmed.
     *
     * @param string $answer
     *
     * @return self
     */
    public function setAnswer(string $answer): self
    {
        $this->initialized['answer'] = true;
        $this->answer = $answer;
        return $this;
    }
    /**
     * Unattributed people who gave it, at least 2.
     *
     * @return int
     */
    public function getPeople(): int
    {
        return $this->people;
    }
    /**
     * Unattributed people who gave it, at least 2.
     *
     * @param int $people
     *
     * @return self
     */
    public function setPeople(int $people): self
    {
        $this->initialized['people'] = true;
        $this->people = $people;
        return $this;
    }
    /**
     * Their net revenue, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * Their net revenue, in integer minor units of the report currency, such as cents.
     *
     * @param int $netRevenue
     *
     * @return self
     */
    public function setNetRevenue(int $netRevenue): self
    {
        $this->initialized['netRevenue'] = true;
        $this->netRevenue = $netRevenue;
        return $this;
    }
}