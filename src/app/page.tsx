import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/transaction/TransactionForm";

export default function Home() {
  return (
    <MainLayout>
      <TransactionForm />
    </MainLayout>
  );
}
