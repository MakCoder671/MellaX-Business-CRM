"use client";

import { use } from "react";

import { Card } from "@/components/form";
import { InvoiceView } from "@/components/invoicing/InvoiceView";

// A thin wrapper — all the actual invoice UI lives in InvoiceView, shared
// with the popup CreateInvoiceModal shows right after "Finalize Invoice"
// so an invoice never looks or behaves differently depending on how you
// got to it. This is just what renders when someone's on this page
// directly (a link from the client profile's Purchases tab, the Reports
// page's Invoices tab, a bookmark, etc).

export default function InvoiceDetailPage({ params }: PageProps<"/dashboard/invoices/[id]">) {
  const { id } = use(params);

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="overflow-hidden p-0">
        <InvoiceView invoiceId={Number(id)} />
      </Card>
    </div>
  );
}
