import BilingualReader from "@/components/bilingual-reader";
import library from "@/Hindi_Literary_100_Samples.json";

export default function Home() {
  return <BilingualReader passages={library.samples} />;
}
