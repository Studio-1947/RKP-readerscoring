import OpenReader from "@/components/open-reader";
import library from "@/Hindi_Literary_100_Samples.json";

export default function Home() {
  return <OpenReader passages={library.samples} />;
}
