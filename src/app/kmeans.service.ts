import { Injectable } from '@angular/core';
import { RFMMetrics } from '../classes/RFM';

// Enhanced interfaces for better type safety
export interface ClusteredRFMMetrics extends RFMMetrics {
  cluster_id: number;
  segment: string;
}

export interface ClusterCenter {
  cluster_id: number;
  recency_center: number;
  frequency_center: number;
  monetary_center: number;
  segment_label: string;
  rank: number;
  composite_score: number;
}

export interface ClusteringResult {
  clusteredMetrics: ClusteredRFMMetrics[];
  centers: ClusterCenter[];
  evaluationMetrics: {
    silhouetteScore: number;
    wcss: number;
    iterations: number;
  };
  optimalK: number;
  dataStats: {
    recencyPercentiles: { p25: number; p50: number; p75: number };
    frequencyPercentiles: { p25: number; p50: number; p75: number };
    monetaryPercentiles: { p25: number; p50: number; p75: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class KMeansService {

  /**
   * Perform enhanced K-means clustering with ranking-based segmentation
   */
  async performEnhancedClustering(metrics: RFMMetrics[]): Promise<ClusteringResult> {
    if (metrics.length === 0) {
      return this.getEmptyResult();
    }

    console.log('🔍 Analyzing data distribution...');
    const dataStats = this.calculateDataStats(metrics);
    this.logDataStats(dataStats);

    console.log('🔍 Finding optimal K using Elbow method...');
    const optimalK = await this.findOptimalK(metrics);
    console.log(`📊 Optimal K selected: ${optimalK}`);

    // Perform final clustering with optimal K
    const result = await this.performKMeansClustering(metrics, optimalK, dataStats);
    
    return {
      ...result,
      optimalK,
      dataStats
    };
  }

  /**
   * Perform K-means clustering with ranking-based segmentation
   */
  async performKMeansClustering(metrics: RFMMetrics[], k: number = 4, dataStats?: any): Promise<ClusteringResult> {
    if (metrics.length === 0) {
      return this.getEmptyResult(k);
    }

    if (!dataStats) {
      dataStats = this.calculateDataStats(metrics);
    }

    // Step 1: Normalize data for clustering
    const normalizedData = this.normalizeData(metrics);
    
    // Step 2: Run pure K-means algorithm
    const { centroids, clusters, iterations } = await this.runKMeansAlgorithm(normalizedData, k);
    
    console.log(`⚡ K-means converged after ${iterations} iterations`);

    // Step 3: Calculate cluster statistics in original scale
    const clusterStats = this.calculateClusterStatistics(metrics, clusters, k);
    
    // Step 4: Rank clusters and assign labels
    const rankedClusters = this.rankClustersAndAssignLabels(clusterStats);
    
    console.log('📊 Cluster Rankings:');
    rankedClusters.forEach(cluster => {
      console.log(`Cluster ${cluster.cluster_id}: ${cluster.segment_label} (Rank ${cluster.rank}, Score: ${cluster.composite_score.toFixed(2)})`);
      console.log(`  Avg R: ${cluster.recency_center.toFixed(1)} days, F: ${cluster.frequency_center.toFixed(1)} orders, M: ${cluster.monetary_center.toLocaleString()} VND`);
    });

    // Step 5: Create labeled results
    const clusteredMetrics = this.createClusteredMetrics(metrics, clusters, rankedClusters);
    const centers = this.denormalizeCenters(centroids, metrics, rankedClusters);

    // Step 6: Calculate evaluation metrics
    const wcss = this.calculateWCSS(normalizedData, centroids, clusters);
    const silhouetteScore = this.calculateSilhouetteScore(normalizedData, clusters);

    return {
      clusteredMetrics,
      centers,
      evaluationMetrics: {
        silhouetteScore,
        wcss,
        iterations
      },
      optimalK: k,
      dataStats
    };
  }

  /**
   * Run pure K-means algorithm
   */
  private async runKMeansAlgorithm(normalizedData: number[][], k: number) {
    let centroids = this.initializeCentroidsKMeansPlusPlus(normalizedData, k);
    let previousCentroids: number[][] = [];
    let iterations = 0;
    const maxIterations = 100;
    const convergenceThreshold = 0.0001;

    // Main K-means loop
    while (!this.centroidsConverged(centroids, previousCentroids, convergenceThreshold) && iterations < maxIterations) {
      previousCentroids = centroids.map(c => [...c]);
      
      // Assign points to closest centroids
      const clusters = this.assignClusters(normalizedData, centroids);
      
      // Update centroids
      centroids = this.updateCentroids(normalizedData, clusters, k);
      iterations++;
    }

    const finalClusters = this.assignClusters(normalizedData, centroids);
    
    return { centroids, clusters: finalClusters, iterations };
  }

  /**
   * Calculate cluster statistics in original scale
   */
  private calculateClusterStatistics(metrics: RFMMetrics[], clusters: number[], k: number) {
    const clusterStats = [];
    
    for (let i = 0; i < k; i++) {
      const clusterMetrics = metrics.filter((_, index) => clusters[index] === i);
      
      if (clusterMetrics.length === 0) {
        clusterStats.push({
          cluster_id: i,
          size: 0,
          avgRecency: 0,
          avgFrequency: 0,
          avgMonetary: 0
        });
        continue;
      }

      const size = clusterMetrics.length;
      const avgRecency = clusterMetrics.reduce((sum, m) => sum + m.recency, 0) / size;
      const avgFrequency = clusterMetrics.reduce((sum, m) => sum + m.frequency, 0) / size;
      const avgMonetary = clusterMetrics.reduce((sum, m) => sum + m.monetary, 0) / size;

      clusterStats.push({
        cluster_id: i,
        size,
        avgRecency,
        avgFrequency,
        avgMonetary
      });
    }
    
    return clusterStats;
  }

  /**
   * Rank clusters based on composite score and assign labels
   */
  private rankClustersAndAssignLabels(clusterStats: any[]): ClusterCenter[] {
    // Define segment labels in priority order
    const segmentLabels = ['VIP', 'Loyal', 'Potential', 'Pay Attention'];
    
    // Calculate composite score for each cluster
    // Note: Lower recency is better (more recent), higher frequency and monetary are better
    const clustersWithScores = clusterStats.map(cluster => {
      // Normalize scores (convert recency to "recentness" by inverting)
      const recencyScore = cluster.avgRecency > 0 ? 1 / cluster.avgRecency : 1; // Higher = more recent
      const frequencyScore = cluster.avgFrequency;
      const monetaryScore = cluster.avgMonetary;
      
      // Calculate composite score (you can adjust weights here)
      const recencyWeight = 0.3;
      const frequencyWeight = 0.3;
      const monetaryWeight = 0.4;
      
      const composite_score = 
        (recencyScore * recencyWeight) + 
        (frequencyScore * frequencyWeight) + 
        (monetaryScore * monetaryWeight);

      return {
        ...cluster,
        composite_score,
        recencyScore,
        frequencyScore,
        monetaryScore
      };
    });

    // Sort by composite score (descending - highest score = best customers)
    clustersWithScores.sort((a, b) => b.composite_score - a.composite_score);
    
    // Assign ranks and labels
    const rankedClusters: ClusterCenter[] = clustersWithScores.map((cluster, index) => {
      const rank = index + 1;
      const segment_label = segmentLabels[Math.min(index, segmentLabels.length - 1)];
      
      return {
        cluster_id: cluster.cluster_id,
        recency_center: cluster.avgRecency,
        frequency_center: cluster.avgFrequency,
        monetary_center: cluster.avgMonetary,
        segment_label,
        rank,
        composite_score: cluster.composite_score
      };
    });

    return rankedClusters;
  }

  /**
   * Create clustered metrics with proper labels
   */
  private createClusteredMetrics(metrics: RFMMetrics[], clusters: number[], rankedClusters: ClusterCenter[]): ClusteredRFMMetrics[] {
    // Create lookup map for cluster labels
    const labelMap = new Map<number, string>();
    rankedClusters.forEach(cluster => {
      labelMap.set(cluster.cluster_id, cluster.segment_label);
    });

    return metrics.map((metric, index) => ({
      ...metric,
      cluster_id: clusters[index],
      segment: labelMap.get(clusters[index]) || `Cluster ${clusters[index]}`
    }));
  }

  /**
   * Denormalize centers back to original scale
   */
  private denormalizeCenters(normalizedCentroids: number[][], originalMetrics: RFMMetrics[], rankedClusters: ClusterCenter[]): ClusterCenter[] {
    // The rankedClusters already have the correct original scale values
    // We just need to return them as ClusterCenter objects
    return rankedClusters;
  }

  // === HELPER METHODS (unchanged from original) ===

  private getEmptyResult(k: number = 0): ClusteringResult {
    return {
      clusteredMetrics: [],
      centers: [],
      evaluationMetrics: { silhouetteScore: 0, wcss: 0, iterations: 0 },
      optimalK: k,
      dataStats: {
        recencyPercentiles: { p25: 0, p50: 0, p75: 0 },
        frequencyPercentiles: { p25: 0, p50: 0, p75: 0 },
        monetaryPercentiles: { p25: 0, p50: 0, p75: 0 }
      }
    };
  }

  private calculateDataStats(metrics: RFMMetrics[]) {
    const recencyValues = metrics.map(m => m.recency).sort((a, b) => a - b);
    const frequencyValues = metrics.map(m => m.frequency).sort((a, b) => a - b);
    const monetaryValues = metrics.map(m => m.monetary).sort((a, b) => a - b);

    return {
      recencyPercentiles: {
        p25: this.percentile(recencyValues, 25),
        p50: this.percentile(recencyValues, 50),
        p75: this.percentile(recencyValues, 75)
      },
      frequencyPercentiles: {
        p25: this.percentile(frequencyValues, 25),
        p50: this.percentile(frequencyValues, 50),
        p75: this.percentile(frequencyValues, 75)
      },
      monetaryPercentiles: {
        p25: this.percentile(monetaryValues, 25),
        p50: this.percentile(monetaryValues, 50),
        p75: this.percentile(monetaryValues, 75)
      }
    };
  }

  private logDataStats(dataStats: any) {
    console.log('📊 Data Statistics:');
    console.log(`Recency P25/P50/P75: ${dataStats.recencyPercentiles.p25}/${dataStats.recencyPercentiles.p50}/${dataStats.recencyPercentiles.p75} days`);
    console.log(`Frequency P25/P50/P75: ${dataStats.frequencyPercentiles.p25}/${dataStats.frequencyPercentiles.p50}/${dataStats.frequencyPercentiles.p75} orders`);
    console.log(`Monetary P25/P50/P75: ${dataStats.monetaryPercentiles.p25.toLocaleString()}/${dataStats.monetaryPercentiles.p50.toLocaleString()}/${dataStats.monetaryPercentiles.p75.toLocaleString()} VND`);
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private async findOptimalK(metrics: RFMMetrics[]): Promise<number> {
    const maxK = Math.min(8, Math.floor(metrics.length / 2));
    const minK = 2;
    const wcssValues: number[] = [];
    
    for (let k = minK; k <= maxK; k++) {
      const dataStats = this.calculateDataStats(metrics);
      const result = await this.performKMeansClustering(metrics, k, dataStats);
      wcssValues.push(result.evaluationMetrics.wcss);
    }

    // Find elbow point
    let optimalK = minK;
    let maxImprovement = 0;

    for (let i = 1; i < wcssValues.length - 1; i++) {
      const improvement = wcssValues[i - 1] - wcssValues[i];
      const nextImprovement = wcssValues[i] - wcssValues[i + 1];
      const improvementRate = improvement - nextImprovement;

      if (improvementRate > maxImprovement) {
        maxImprovement = improvementRate;
        optimalK = minK + i;
      }
    }

    return optimalK;
  }

  private normalizeData(metrics: RFMMetrics[]): number[][] {
    const recencyValues = metrics.map(m => m.recency);
    const frequencyValues = metrics.map(m => m.frequency);
    const monetaryValues = metrics.map(m => m.monetary);

    const stats = {
      recency: { min: Math.min(...recencyValues), max: Math.max(...recencyValues) },
      frequency: { min: Math.min(...frequencyValues), max: Math.max(...frequencyValues) },
      monetary: { min: Math.min(...monetaryValues), max: Math.max(...monetaryValues) }
    };

    return metrics.map(metric => [
      this.normalize(metric.recency, stats.recency.min, stats.recency.max),
      this.normalize(metric.frequency, stats.frequency.min, stats.frequency.max),
      this.normalize(metric.monetary, stats.monetary.min, stats.monetary.max)
    ]);
  }

  private normalize(value: number, min: number, max: number): number {
    return max === min ? 0 : (value - min) / (max - min);
  }

  private initializeCentroidsKMeansPlusPlus(data: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    
    const firstIndex = Math.floor(Math.random() * data.length);
    centroids.push([...data[firstIndex]]);

    for (let i = 1; i < k; i++) {
      const distances = data.map(point => {
        const minDistance = Math.min(...centroids.map(centroid => 
          this.euclideanDistance(point, centroid)
        ));
        return minDistance * minDistance;
      });

      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      const randomValue = Math.random() * totalDistance;
      
      let cumulativeDistance = 0;
      for (let j = 0; j < data.length; j++) {
        cumulativeDistance += distances[j];
        if (cumulativeDistance >= randomValue) {
          centroids.push([...data[j]]);
          break;
        }
      }
    }

    return centroids;
  }

  private assignClusters(data: number[][], centroids: number[][]): number[] {
    return data.map(point => {
      let minDistance = Infinity;
      let closestCentroid = 0;

      centroids.forEach((centroid, index) => {
        const distance = this.euclideanDistance(point, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroid = index;
        }
      });

      return closestCentroid;
    });
  }

  private euclideanDistance(point1: number[], point2: number[]): number {
    return Math.sqrt(
      point1.reduce((sum, val, index) => sum + Math.pow(val - point2[index], 2), 0)
    );
  }

  private updateCentroids(data: number[][], clusters: number[], k: number): number[][] {
    const newCentroids: number[][] = [];

    for (let i = 0; i < k; i++) {
      const clusterPoints = data.filter((_, index) => clusters[index] === i);
      
      if (clusterPoints.length === 0) {
        newCentroids.push([Math.random(), Math.random(), Math.random()]);
        continue;
      }

      const centroid = clusterPoints[0].map((_, dimIndex) =>
        clusterPoints.reduce((sum, point) => sum + point[dimIndex], 0) / clusterPoints.length
      );

      newCentroids.push(centroid);
    }

    return newCentroids;
  }

  private centroidsConverged(current: number[][], previous: number[][], threshold: number = 0.0001): boolean {
    if (previous.length === 0) return false;
    
    return current.every((centroid, index) =>
      centroid.every((val, dimIndex) =>
        Math.abs(val - previous[index][dimIndex]) < threshold
      )
    );
  }

  private calculateWCSS(data: number[][], centroids: number[][], clusters: number[]): number {
    let wcss = 0;
    
    data.forEach((point, index) => {
      const centroid = centroids[clusters[index]];
      const distance = this.euclideanDistance(point, centroid);
      wcss += distance * distance;
    });
    
    return wcss;
  }

  private calculateSilhouetteScore(data: number[][], clusters: number[]): number {
    if (data.length <= 1) return 0;
    
    const silhouetteScores: number[] = [];
    
    data.forEach((point, i) => {
      const cluster = clusters[i];
      
      const sameClusterPoints = data.filter((_, j) => clusters[j] === cluster && i !== j);
      const a = sameClusterPoints.length > 0 
        ? sameClusterPoints.reduce((sum, otherPoint) => sum + this.euclideanDistance(point, otherPoint), 0) / sameClusterPoints.length
        : 0;
      
      const otherClusters = [...new Set(clusters)].filter(c => c !== cluster);
      const b = Math.min(...otherClusters.map(otherCluster => {
        const otherClusterPoints = data.filter((_, j) => clusters[j] === otherCluster);
        return otherClusterPoints.length > 0
          ? otherClusterPoints.reduce((sum, otherPoint) => sum + this.euclideanDistance(point, otherPoint), 0) / otherClusterPoints.length
          : Infinity;
      }));
      
      const silhouette = (b - a) / Math.max(a, b);
      silhouetteScores.push(silhouette);
    });
    
    return silhouetteScores.reduce((sum, score) => sum + score, 0) / silhouetteScores.length;
  }
}