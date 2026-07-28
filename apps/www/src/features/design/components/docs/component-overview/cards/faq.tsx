"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@voidhash/ui";
import { Button } from "@voidhash/ui";
import { Card, CardContent, CardFooter } from "@voidhash/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voidhash/ui";

const GENERAL_QUESTIONS = [
  {
    q: "How secure is my financial data with Ledger?",
    a: "We use bank-level AES-256 encryption, SOC 2 Type II certified infrastructure, and never store your credentials. All connections use read-only access tokens. We are a SEC registered investment advisor.",
  },
  {
    q: "How do I connect my bank or investment accounts?",
    a: "Go to Settings > Linked Accounts and search for your institution. We support over 12,000 banks and brokerages via Plaid and MX.",
  },
  {
    q: "Can I export my data for tax purposes?",
    a: "Yes. Navigate to Reports > Tax Export to download a CSV or PDF summary of your transactions, dividends, and capital gains for any tax year.",
  },
];

const SYNC_QUESTIONS = [
  {
    q: "How often does data refresh?",
    a: "Connected institutions sync every six hours, and you can pull a manual refresh from the account detail view at any time.",
  },
  {
    q: "Why is a transaction missing?",
    a: "Pending transactions appear once the institution posts them. If a posted transaction is still missing after 48 hours, reconnect the account from Settings.",
  },
  {
    q: "Can I import a statement manually?",
    a: "Yes. Upload a CSV or OFX file from the account detail view and map the columns once — the mapping is remembered for later imports.",
  },
];

const GOALS_QUESTIONS = [
  {
    q: "How do I set up a custom financial goal?",
    a: "Click New Goal from the Savings Targets card. Choose a category, set a target amount and date, and we'll calculate the monthly contribution needed.",
  },
  {
    q: "Can I track multiple goals at once?",
    a: "Yes. Pro accounts can track unlimited goals. Basic accounts support up to 3 active goals.",
  },
  {
    q: "How are monthly contributions calculated?",
    a: "We divide the remaining amount by the number of months until your target date, adjusted for your current savings rate and any auto-transfer schedules.",
  },
];

function QuestionList({ questions }: { questions: { q: string; a: string }[] }) {
  return (
    <Accordion type="single" collapsible defaultValue="item-0">
      {questions.map((item, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function Faq() {
  return (
    <Card>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              General
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex-1">
              Sync
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex-1">
              Goals
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <QuestionList questions={GENERAL_QUESTIONS} />
          </TabsContent>
          <TabsContent value="sync">
            <QuestionList questions={SYNC_QUESTIONS} />
          </TabsContent>
          <TabsContent value="goals">
            <QuestionList questions={GOALS_QUESTIONS} />
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full">
          Contact Support
        </Button>
        <Button variant="link" className="w-full">
          Learn More
        </Button>
      </CardFooter>
    </Card>
  );
}
