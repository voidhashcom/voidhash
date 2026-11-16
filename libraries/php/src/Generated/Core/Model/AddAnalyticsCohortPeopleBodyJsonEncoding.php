<?php

namespace Voidhash\Generated\Core\Model;

class AddAnalyticsCohortPeopleBodyJsonEncoding
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
     * People by person id, up to 10000 in one request.
     *
     * @var list<string>|null
     */
    protected $personIds;
    /**
     * People by a distinct id they were identified with, up to 10000 in one request.
     *
     * @var list<string>|null
     */
    protected $distinctIds;
    /**
     * People by email, up to 10000 in one request.
     *
     * @var list<string>|null
     */
    protected $emails;
    /**
     * People by person id, up to 10000 in one request.
     *
     * @return list<string>|null
     */
    public function getPersonIds(): ?array
    {
        return $this->personIds;
    }
    /**
     * People by person id, up to 10000 in one request.
     *
     * @param list<string>|null $personIds
     *
     * @return self
     */
    public function setPersonIds(?array $personIds): self
    {
        $this->initialized['personIds'] = true;
        $this->personIds = $personIds;
        return $this;
    }
    /**
     * People by a distinct id they were identified with, up to 10000 in one request.
     *
     * @return list<string>|null
     */
    public function getDistinctIds(): ?array
    {
        return $this->distinctIds;
    }
    /**
     * People by a distinct id they were identified with, up to 10000 in one request.
     *
     * @param list<string>|null $distinctIds
     *
     * @return self
     */
    public function setDistinctIds(?array $distinctIds): self
    {
        $this->initialized['distinctIds'] = true;
        $this->distinctIds = $distinctIds;
        return $this;
    }
    /**
     * People by email, up to 10000 in one request.
     *
     * @return list<string>|null
     */
    public function getEmails(): ?array
    {
        return $this->emails;
    }
    /**
     * People by email, up to 10000 in one request.
     *
     * @param list<string>|null $emails
     *
     * @return self
     */
    public function setEmails(?array $emails): self
    {
        $this->initialized['emails'] = true;
        $this->emails = $emails;
        return $this;
    }
}