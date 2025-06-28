import { Injectable, inject } from '@angular/core';
import { 
  Firestore,
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy, 
  limit,
  deleteDoc,
  doc,
  setDoc
} from '@angular/fire/firestore';
import { RFMMetrics, RFMSegmentation } from '../classes/RFM';
import { RFMCalculatorService } from './rfm-calculator.service';
import { KMeansService, ClusteringResult, ClusteredRFMMetrics } from './kmeans.service';

@Injectable({
  providedIn: 'root'
})
export class RfmService {
  private firestore = inject(Firestore);
  private rfmCalculator = inject(RFMCalculatorService);
  private kmeansService = inject(KMeansService);

  private readonly COLLECTIONS = {
    RFM_SEGMENTATION: 'RFMSegmentation',
    RFM_ANALYSIS_RESULTS: 'RFMAnalysisResults',
    RFM_CLUSTER_CENTERS: 'RFMClusterCenters'
  };

  /**
   * Check if segmentation should run (every 7 days or on demand)
   */
  async shouldRunSegmentation(): Promise<boolean> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_ANALYSIS_RESULTS),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('📊 No previous segmentation found - running analysis');
        return true;
      }

      const lastAnalysis = snapshot.docs[0].data();
      const lastDate = new Date(lastAnalysis['created_at']);
      const currentDate = new Date();
      const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`📅 Last segmentation: ${daysDiff} days ago`);
      return daysDiff >= 7;
    } catch (error) {
      console.error('❌ Error checking segmentation schedule:', error);
      return true; // Run segmentation on error
    }
  }

  /**
   * Run complete RFM Analysis with enhanced K-means clustering
   */
  async runRFMAnalysis(): Promise<ClusteringResult> {
    try {
      console.log('🚀 Starting Enhanced RFM Analysis...');
      
      // 1. Calculate RFM metrics
      const rawMetrics = await this.rfmCalculator.calculateRFMMetrics();
      console.log(`📊 Calculated metrics for ${rawMetrics.length} customers`);

      if (rawMetrics.length === 0) {
        console.log('⚠️  No customers with orders found');
        throw new Error('No customer data available for analysis');
      }

      // 2. Perform enhanced K-means clustering with optimal K selection
      const clusteringResult = await this.kmeansService.performEnhancedClustering(rawMetrics);
      console.log(`✅ K-means clustering completed with K=${clusteringResult.optimalK}`);
      console.log(`📈 Silhouette Score: ${clusteringResult.evaluationMetrics.silhouetteScore.toFixed(3)}`);

      // 3. Save comprehensive results
      await this.saveCompleteAnalysis(clusteringResult);
      console.log('💾 RFM Analysis saved successfully');

      return clusteringResult;

    } catch (error) {
      console.error('❌ Error in RFM Analysis:', error);
      throw error;
    }
  }

  /**
   * Save complete analysis results including segmentation, centers, and metrics
   */
  private async saveCompleteAnalysis(result: ClusteringResult): Promise<void> {
    try {
      const currentTime = new Date().toISOString();
      
      // Clear old data
      await this.clearOldAnalysisData();

      // 1. Save individual customer segmentations
      await this.saveCustomerSegmentations(result.clusteredMetrics, currentTime);

      // 2. Save cluster centers
      await this.saveClusterCenters(result.centers, currentTime);

      // 3. Save analysis metadata
      await this.saveAnalysisMetadata(result, currentTime);

      console.log('✅ Complete analysis saved successfully');
    } catch (error) {
      console.error('❌ Error saving complete analysis:', error);
      throw error;
    }
  }

  /**
   * Save customer segmentations
   */
  private async saveCustomerSegmentations(clusteredMetrics: ClusteredRFMMetrics[], timestamp: string): Promise<void> {
    const batch = [];

    for (const metric of clusteredMetrics) {
      const segmentationData: Omit<RFMSegmentation, 'id'> = {
        user_id: metric.user_id,
        recency: metric.recency,
        frequency: metric.frequency,
        monetary: metric.monetary,
        rfm_score: metric.rfm_score,
        segment: metric.segment,
        cluster_id: metric.cluster_id,
        created_at: timestamp,
        updated_at: timestamp
      };

      batch.push(
        addDoc(collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION), segmentationData)
      );
    }

    await Promise.all(batch);
    console.log(`📊 Saved ${clusteredMetrics.length} customer segmentations`);
  }

  /**
   * Save cluster centers
   */
  private async saveClusterCenters(centers: any[], timestamp: string): Promise<void> {
    const batch = [];

    for (const center of centers) {
      const centerData = {
        ...center,
        created_at: timestamp,
        updated_at: timestamp
      };

      batch.push(
        addDoc(collection(this.firestore, this.COLLECTIONS.RFM_CLUSTER_CENTERS), centerData)
      );
    }

    await Promise.all(batch);
    console.log(`🎯 Saved ${centers.length} cluster centers`);
  }

  /**
   * Save analysis metadata and evaluation metrics
   */
  private async saveAnalysisMetadata(result: ClusteringResult, timestamp: string): Promise<void> {
    const analysisData = {
      optimal_k: result.optimalK,
      total_customers: result.clusteredMetrics.length,
      silhouette_score: result.evaluationMetrics.silhouetteScore,
      wcss: result.evaluationMetrics.wcss,
      iterations: result.evaluationMetrics.iterations,
      segment_distribution: this.calculateSegmentDistribution(result.clusteredMetrics),
      created_at: timestamp,
      updated_at: timestamp
    };

    await addDoc(collection(this.firestore, this.COLLECTIONS.RFM_ANALYSIS_RESULTS), analysisData);
    console.log('📈 Analysis metadata saved');
  }

  /**
   * Calculate segment distribution for reporting
   */
  private calculateSegmentDistribution(clusteredMetrics: ClusteredRFMMetrics[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    clusteredMetrics.forEach(metric => {
      distribution[metric.segment] = (distribution[metric.segment] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Clear all old analysis data
   */
  private async clearOldAnalysisData(): Promise<void> {
    try {
      await Promise.all([
        this.clearCollection(this.COLLECTIONS.RFM_SEGMENTATION),
        this.clearCollection(this.COLLECTIONS.RFM_CLUSTER_CENTERS),
        this.clearCollection(this.COLLECTIONS.RFM_ANALYSIS_RESULTS)
      ]);
      console.log('🧹 Old analysis data cleared');
    } catch (error) {
      console.error('❌ Error clearing old data:', error);
    }
  }

  /**
   * Helper method to clear a collection
   */
  private async clearCollection(collectionName: string): Promise<void> {
    const q = query(collection(this.firestore, collectionName));
    const snapshot = await getDocs(q);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  /**
   * Get customer segmentation by user ID
   */
  async getCustomerSegmentation(userId: string): Promise<RFMSegmentation | null> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;

      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RFMSegmentation;
    } catch (error) {
      console.error('❌ Error getting customer segmentation:', error);
      return null;
    }
  }

  /**
   * Get all current segmentations
   */
  async getAllSegmentations(): Promise<RFMSegmentation[]> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        orderBy('monetary', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as RFMSegmentation));
    } catch (error) {
      console.error('❌ Error getting all segmentations:', error);
      return [];
    }
  }

  /**
   * Get segmentations by specific segment
   */
  async getSegmentationBySegment(segment: string): Promise<RFMSegmentation[]> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        where('segment', '==', segment),
        orderBy('monetary', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as RFMSegmentation));
    } catch (error) {
      console.error('❌ Error getting segmentation by segment:', error);
      return [];
    }
  }

  /**
   * Get latest analysis results with metrics
   */
  async getLatestAnalysisResults(): Promise<any | null> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_ANALYSIS_RESULTS),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;

      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
      console.error('❌ Error getting latest analysis results:', error);
      return null;
    }
  }

  /**
   * Get cluster centers from latest analysis
   */
  async getClusterCenters(): Promise<any[]> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_CLUSTER_CENTERS),
        orderBy('cluster_id', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
    } catch (error) {
      console.error('❌ Error getting cluster centers:', error);
      return [];
    }
  }

  /**
   * Get segment statistics
   */
  async getSegmentStatistics(): Promise<any> {
    try {
      const segmentations = await this.getAllSegmentations();
      
      if (segmentations.length === 0) {
        return { total: 0, segments: {} };
      }

      const stats: any = {
        total: segmentations.length,
        segments: {}
      };

      // Group by segment
      const segmentGroups = segmentations.reduce((groups: any, item) => {
        const segment = item.segment;
        if (!groups[segment]) {
          groups[segment] = [];
        }
        groups[segment].push(item);
        return groups;
      }, {});

      // Calculate statistics for each segment
      Object.keys(segmentGroups).forEach(segment => {
        const customers = segmentGroups[segment];
        const count = customers.length;
        const totalMonetary = customers.reduce((sum: number, c: any) => sum + c.monetary, 0);
        const avgMonetary = totalMonetary / count;
        const avgRecency = customers.reduce((sum: number, c: any) => sum + c.recency, 0) / count;
        const avgFrequency = customers.reduce((sum: number, c: any) => sum + c.frequency, 0) / count;

        stats.segments[segment] = {
          count,
          percentage: ((count / segmentations.length) * 100).toFixed(1),
          avgMonetary: Math.round(avgMonetary),
          avgRecency: Math.round(avgRecency),
          avgFrequency: Math.round(avgFrequency * 10) / 10,
          totalValue: Math.round(totalMonetary)
        };
      });

      return stats;
    } catch (error) {
      console.error('❌ Error calculating segment statistics:', error);
      return { total: 0, segments: {} };
    }
  }

  /**
   * Force run analysis (bypass schedule check)
   */
  async forceRunAnalysis(): Promise<ClusteringResult> {
    console.log('🔄 Force running RFM Analysis...');
    return await this.runRFMAnalysis();
  }

  /**
   * Get analysis health check
   */
  async getAnalysisHealthCheck(): Promise<{
    hasData: boolean;
    lastAnalysis: Date | null;
    daysSinceLastAnalysis: number;
    totalCustomers: number;
    totalSegments: number;
    qualityScore: number;
  }> {
    try {
      const latestAnalysis = await this.getLatestAnalysisResults();
      const segmentations = await this.getAllSegmentations();
      
      let lastAnalysis: Date | null = null;
      let daysSinceLastAnalysis = 0;
      let qualityScore = 0;

      if (latestAnalysis) {
        lastAnalysis = new Date(latestAnalysis.created_at);
        daysSinceLastAnalysis = Math.floor((new Date().getTime() - lastAnalysis.getTime()) / (1000 * 60 * 60 * 24));
        qualityScore = latestAnalysis.silhouette_score || 0;
      }

      const uniqueSegments = new Set(segmentations.map(s => s.segment)).size;

      return {
        hasData: segmentations.length > 0,
        lastAnalysis,
        daysSinceLastAnalysis,
        totalCustomers: segmentations.length,
        totalSegments: uniqueSegments,
        qualityScore: Math.round(qualityScore * 1000) / 1000
      };
    } catch (error) {
      console.error('❌ Error getting analysis health check:', error);
      return {
        hasData: false,
        lastAnalysis: null,
        daysSinceLastAnalysis: 0,
        totalCustomers: 0,
        totalSegments: 0,
        qualityScore: 0
      };
    }
  }
}