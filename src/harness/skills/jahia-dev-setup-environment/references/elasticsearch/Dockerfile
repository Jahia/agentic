# 9.1.3 is the floor: elasticsearch-connector 4.x carries the elasticsearch-java 9.1.3 client, which
# talks to a server of its version or later. jCustomer 3.0 asks for Elasticsearch 9 or above.
FROM docker.elastic.co/elasticsearch/elasticsearch:9.5.3

# analysis-icu is always required. The other two serve Polish and Japanese sites
RUN elasticsearch-plugin install --batch analysis-icu analysis-stempel analysis-kuromoji
