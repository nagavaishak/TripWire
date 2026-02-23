import dotenv from 'dotenv';
dotenv.config();

import { YouTubeCollector } from './src/collectors/youtube.collector';
import { AttentionIndexComputer } from './src/index/computer';

async function testAllCollectors() {
    console.log('Testing data collectors...\n');

    const topic = 'Solana';

    // Test YouTube
    console.log('1. Testing YouTube...');
    const youtube = new YouTubeCollector();
    const youtubeData = await youtube.collect(topic);
    console.log(`   ✓ Videos:      ${youtubeData.video_count}`);
    console.log(`   ✓ Total views: ${youtubeData.total_views}`);
    console.log(`   ✓ Weighted likes ratio: ${youtubeData.avg_view_weighted_likes.toFixed(4)}`);

    // Test full index computation
    console.log('\n2. Testing full index computation...');
    const computer = new AttentionIndexComputer();
    const doa = await computer.compute(topic);
    console.log(`   ✓ ${topic} Attention Score: ${doa.toFixed(2)} DoA`);

    // Test second topic
    console.log('\n3. Testing second topic (AI)...');
    const doa2 = await computer.compute('AI');
    console.log(`   ✓ AI Attention Score: ${doa2.toFixed(2)} DoA`);

    console.log('\n✅ All tests passed!\n');
    process.exit(0);
}

testAllCollectors().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});
