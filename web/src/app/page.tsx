import { getSession } from "@/lib/auth";
import LandingContent from "@/components/landing/LandingContent";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default async function LandingPage() {
  const user = await getSession();

  return (
    <>
      <Header transparent />
      <main>
        <LandingContent
          user={user ? { fullName: user.fullName, role: user.role } : null}
        />
      </main>
      <Footer />
    </>
  );
}
