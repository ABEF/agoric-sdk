<script>
  import ListCard from "../lib/ListCard.svelte";
  import Card from 'smelte/src/components/Card';
  import Dapp from "./Dapp.svelte";

  import { dapps } from './store';
</script>

<ListCard items={$dapps}>
  <div slot="title">
    <Card.Title title="Dapps" />
  </div>

  <div slot="empty">
    No Dapps.
  </div>

  <div slot="item-header" let:item>
    <Dapp {item} details={false}/>
  </div>

  <div slot="item-details" let:item>
    <Dapp {item} summary={false}/>
  </div>
</ListCard>
